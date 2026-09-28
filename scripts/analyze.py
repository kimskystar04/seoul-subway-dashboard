"""Analyze the raw Seoul subway ridership CSV and emit data/processed/dashboard_data.json.

Usage:
    python scripts/analyze.py [--raw PATH] [--baseline PATH] [--out PATH]

The script never modifies the raw CSV. It validates the raw file's SHA-256
against docs/baseline.json, recomputes the same summary values independently,
compares them against the baseline, and aborts (non-zero exit) on mismatch.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

REQUIRED_COLUMNS = ["사용일자", "노선명", "역명", "승차총승객수", "하차총승객수", "등록일자"]

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_RAW = PROJECT_ROOT / "data" / "raw" / "CARD_SUBWAY_MONTH_202608.csv"
DEFAULT_BASELINE = PROJECT_ROOT / "docs" / "baseline.json"
DEFAULT_OUT = PROJECT_ROOT / "data" / "processed" / "dashboard_data.json"


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_raw(path: Path) -> pd.DataFrame:
    # NOTE: the raw CSV has a trailing empty field on every data row while the
    # header only names 6 columns. Without index_col=False, pandas silently
    # treats the first field as an implicit index and shifts every other
    # column by one, corrupting boarding/alighting counts. This was found
    # during dataset exploration (docs/ANALYSIS_BASELINE.md).
    df = pd.read_csv(path, encoding="utf-8-sig", index_col=False)

    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"CSV is missing expected columns: {missing}")

    df = df[REQUIRED_COLUMNS].copy()

    df["사용일자"] = pd.to_datetime(df["사용일자"], format="%Y%m%d", errors="raise")
    df["승차총승객수"] = pd.to_numeric(df["승차총승객수"], errors="raise").astype("int64")
    df["하차총승객수"] = pd.to_numeric(df["하차총승객수"], errors="raise").astype("int64")

    if (df["승차총승객수"] < 0).any() or (df["하차총승객수"] < 0).any():
        raise ValueError("Negative boarding/alighting values found in raw CSV")

    return df


def build_summary(df: pd.DataFrame) -> dict:
    df = df.copy()
    df["usage"] = df["승차총승객수"] + df["하차총승객수"]

    daily = df.groupby(df["사용일자"].dt.date)["usage"].sum()
    weekday_mask = pd.to_datetime(daily.index).dayofweek < 5

    weekday_day_count = int(weekday_mask.sum())
    weekend_day_count = int((~weekday_mask).sum())
    weekday_total = int(daily[weekday_mask].sum())
    weekend_total = int(daily[~weekday_mask].sum())

    return {
        "valid_rows": int(len(df)),
        "total_boardings": int(df["승차총승객수"].sum()),
        "total_alightings": int(df["하차총승객수"].sum()),
        "total_usage": int(df["usage"].sum()),
        "weekday_day_count": weekday_day_count,
        "weekend_day_count": weekend_day_count,
        "weekday_daily_average": round(weekday_total / weekday_day_count, 2) if weekday_day_count else 0.0,
        "weekend_daily_average": round(weekend_total / weekend_day_count, 2) if weekend_day_count else 0.0,
    }


def build_top_stations(df: pd.DataFrame, n: int = 10) -> list[dict]:
    grouped = df.groupby("역명")[["승차총승객수", "하차총승객수"]].sum()
    grouped["total_usage"] = grouped["승차총승객수"] + grouped["하차총승객수"]
    top = grouped.sort_values("total_usage", ascending=False).head(n)
    return [
        {"station": station, "total_usage": int(row["total_usage"])}
        for station, row in top.iterrows()
    ]


def compare_to_baseline(summary: dict, top_stations: list[dict], baseline: dict) -> list[str]:
    errors = []
    base_summary = baseline["summary"]
    for key, expected in base_summary.items():
        actual = summary[key]
        if isinstance(expected, float):
            if abs(actual - expected) > 0.01:
                errors.append(f"summary.{key}: expected {expected}, got {actual}")
        elif actual != expected:
            errors.append(f"summary.{key}: expected {expected}, got {actual}")

    for i, expected in enumerate(baseline.get("top_stations_first3", [])):
        if i >= len(top_stations) or top_stations[i] != expected:
            actual = top_stations[i] if i < len(top_stations) else None
            errors.append(f"top_stations[{i}]: expected {expected}, got {actual}")

    return errors


def build_records(df: pd.DataFrame) -> list[dict]:
    out = []
    for row in df.itertuples(index=False):
        out.append(
            {
                "date": row.사용일자.strftime("%Y-%m-%d"),
                "line": row.노선명,
                "station": row.역명,
                "boardings": int(row.승차총승객수),
                "alightings": int(row.하차총승객수),
            }
        )
    return out


def run(raw_path: Path, baseline_path: Path, out_path: Path) -> dict:
    baseline = json.loads(baseline_path.read_text(encoding="utf-8"))

    actual_hash = sha256_of(raw_path)
    expected_hash = baseline["dataset"]["sha256"]
    if actual_hash != expected_hash:
        raise SystemExit(
            f"[ABORT] SHA-256 mismatch for {raw_path.name}\n"
            f"  expected: {expected_hash}\n"
            f"  actual:   {actual_hash}\n"
            "Refusing to generate dashboard_data.json from an unverified dataset."
        )

    df = load_raw(raw_path)
    summary = build_summary(df)
    top_stations = build_top_stations(df, n=10)

    errors = compare_to_baseline(summary, top_stations, baseline)
    if errors:
        raise SystemExit(
            "[ABORT] Computed summary does not match docs/baseline.json:\n  "
            + "\n  ".join(errors)
        )

    date_min = df["사용일자"].min().strftime("%Y-%m-%d")
    date_max = df["사용일자"].max().strftime("%Y-%m-%d")

    payload = {
        "metadata": {
            "source_file": raw_path.name,
            "sha256": actual_hash,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "date_start": date_min,
            "date_end": date_max,
            "valid_rows": summary["valid_rows"],
        },
        "summary": summary,
        "top_stations": top_stations,
        "records": build_records(df),
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    try:
        out_display = out_path.relative_to(PROJECT_ROOT)
    except ValueError:
        out_display = out_path

    print(f"[PASS] {raw_path.name} matches docs/baseline.json")
    print(f"[PASS] valid_rows={summary['valid_rows']} total_usage={summary['total_usage']}")
    print(f"[OK] wrote {out_display}")

    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw", type=Path, default=DEFAULT_RAW)
    parser.add_argument("--baseline", type=Path, default=DEFAULT_BASELINE)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    run(args.raw, args.baseline, args.out)


if __name__ == "__main__":
    main()
