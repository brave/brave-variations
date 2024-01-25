#!/usr/bin/env python3
import json
import sys


def _load_studies(filename="seed/seed.json"):
    with open(filename) as fh:
        studies = json.load(fh)
    return studies


def _save_studies(studies, filename="seed/seed.json"):
    with open(filename, "w") as fh:
        json.dump(studies, fh, indent=4)
        # Many editors such as GitHub Web add a newline at the end of the file.
        # Append it here too to prevent this as a change in `git diff`.
        fh.write("\n")


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
        "experiments": [
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


def _upsert_study(
    name: str,
    enable_feature: str,
    probability_enabled: int,
    channel: list[str],
    platform: list[str],
    min_version: str,
):
    rawstudies = _load_studies()
    studies: list[dict] = rawstudies["studies"]
    study_to_add = _create_study(
        name,
        enable_feature,
        probability_enabled,
        channel,
        platform,
        min_version,
    )
    existing_study = False
    for idx, study in enumerate(studies):
        if study["name"] == name:
            existing_study = True
            studies[idx] = study_to_add
            # print(studies[idx])
    if not existing_study:
        studies.append(study_to_add)

    _save_studies(rawstudies)


def fmt():
    studies = _load_studies()
    _save_studies(studies)


if __name__ == "__main__":
    args = sys.argv
    # Exec func and args from cli
    func = args[1]
    match func:
        case "upsert_study":
            if len(args) < 7:
                print("Insufficient arguments supplied! Needs:")
                print(
                    "name enable_feature probability_enabled channel platform [min_version]"
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
            fmt()
        case _:
            raise ValueError("Unrecognized function")
