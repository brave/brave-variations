#!/usr/bin/env python3
import sys
from pathlib import Path

import json5


def _create_study(
    name: str,
    enable_feature: str,
    probability_enabled: int,
    channel: list[str],
    platform: list[str],
    min_version: str,
) -> dict:
    study = {
        "name": name,
        "experiment": [
            {
                "name": "Enabled",
                "probability_weight": probability_enabled,
                "feature_association": {"enable_feature": [enable_feature]},
            },
            {"name": "Default", "probability_weight": 100 - probability_enabled},
        ],
        "filter": {
            "channel": channel,
            "platform": platform,
        },
    }
    if min_version:
        study["filter"]["min_version"] = min_version
    return study


def _load_study(filename):
    with Path(filename).open() as fh:
        return json5.load(fh)


def _save_study(study, filename):
    with Path(filename).open("w") as fh:
        json5.dump(
            study,
            fh,
            indent=2,
            quote_keys=False,
            trailing_commas=True,
            quote_style="PREFER_SINGLE",
        )
        # Many editors such as GitHub Web add a newline at the end of the file.
        # Append it here too to prevent this as a change in `git diff`.
        fh.write("\n")


def _upsert_study(
    name: str,
    enable_feature: str,
    probability_enabled: int,
    channel: list[str],
    platform: list[str],
    min_version: str,
):
    basename = Path(name).name
    if basename != name:
        raise ValueError(
            f"Invalid study name '{name}'. Only simple filenames are allowed."
        )
    study_to_add = _create_study(
        name,
        enable_feature,
        probability_enabled,
        channel,
        platform,
        min_version,
    )
    filename = f"studies/{basename}.json5"
    _save_study(study_to_add, filename)
    print(filename)


def fmt(filenames=None):
    if filenames:
        # Process specific files
        study_files = []
        for filename in filenames:
            if filename.startswith("studies/") and filename.endswith(".json5"):
                # Already a full path
                study_files.append(filename)
            else:
                # Just a study name, add the path and extension
                study_files.append(f"studies/{filename}.json5")
    else:
        # Find all .json5 files in the studies folder
        study_files = [str(p) for p in Path("studies").glob("*.json5")]

    for filename in study_files:
        # Load the study
        study = _load_study(filename)
        # Save it (this will reformat it)
        _save_study(study, filename)
        print(f"Formatted: {filename}")


if __name__ == "__main__":
    args = sys.argv
    # Exec func and args from cli
    func = args[1]
    match func:
        case "upsert_study":
            if len(args) < 7:
                print("Insufficient arguments supplied! Needs:")
                print(
                    "name enable_feature probability_enabled channel platform "
                    "[min_version]"
                )
                sys.exit(1)
            name = args[2]
            enable_feature = args[3]
            probability_enabled = args[4]
            channel = args[5]
            platform = args[6]
            min_version = ""
            if len(args) > 7:
                min_version = args[7]
            _upsert_study(
                name,
                enable_feature,
                probability_enabled=int(probability_enabled),
                channel=channel.split(","),
                platform=platform.split(","),
                min_version=min_version,
            )
        case "fmt":
            # Pass any additional arguments as filenames
            filenames = args[2:] if len(args) > 2 else None
            fmt(filenames)
        case _:
            raise ValueError("Unrecognized function")
