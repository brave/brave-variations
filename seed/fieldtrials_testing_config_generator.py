#!/usr/bin/env vpython3
# Copyright (c) 2022 The Brave Authors. All rights reserved.
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# you can obtain one at https://mozilla.org/MPL/2.0/.
"""Generate the most probable testing config in chromium format

For a single study the experiment with maximum probability_weight will be
chosen (the first one in the list if there are many of them).

Filters that are processed here: min_version, max_version, channel.
Filters to be ignored: min_os_version, county.
Filters that will be processed by chromium code later: platforms

The format description:
https://chromium.googlesource.com/chromium/src/+/master/testing/variations/README.md
"""

import argparse
import json
import os
import re
import serialize
import subprocess
import sys
import tempfile

from datetime import datetime, timezone
from packaging import version

import proto.study_pb2 as study_pb2
import proto.variations_seed_pb2 as variations_seed_pb2

PLATFORM_NAMES = {
    study_pb2.Study.Platform.PLATFORM_WINDOWS: 'windows',
    study_pb2.Study.Platform.PLATFORM_MAC: 'mac',
    study_pb2.Study.Platform.PLATFORM_LINUX: 'linux',
    study_pb2.Study.Platform.PLATFORM_IOS: 'ios',
    study_pb2.Study.Platform.PLATFORM_ANDROID: 'android'
}

# The date when `production` branch was deprecated and moved to archive.
# Now the production seed is stored in main branch.
PRODUCTION_BRANCH_MIGRATION_DATE = datetime(2024, 8, 9, tzinfo=timezone.utc)
LEGACY_SEED_PATH = 'seed/seed.json'
SEED_FOLDER = 'studies/'

def _get_variations_revision(date: str, branch: str) -> str:
    args = ['git', 'rev-list', '-n', '1', '--first-parent']
    if date:
      args.append(f'--before={date}')
    args.append(f'origin/{branch}')
    output = subprocess.check_output(args)
    return output.rstrip().decode('utf-8')


def _get_variations_seed_legacy(revision: str):
    seed_string = subprocess.check_output(
        ['git', 'show', f'{revision}:{LEGACY_SEED_PATH}'])
    json_seed = json.loads(seed_string)
    print("Validate seed data")
    if not serialize.validate(json_seed):
        raise RuntimeError("Seed data is invalid")
    return serialize.make_variations_seed_message(json_seed)

def _get_variations_seed(revision: str):
    legacy_seed = _get_variations_seed_legacy(revision)
    if legacy_seed is not None:
        return legacy_seed

    print('Run npm install..')
    subprocess.check_output(['npm', 'install'])

    tmp_dir = tempfile.mkdtemp(f'studies-{revision}')
    print('temp directory to seed data:', tmp_dir)

    seed_path = os.path.join(tmp_dir, 'seed.bin')

    files_output = subprocess.check_output(
        ['git', 'show', f'{revision}:{SEED_FOLDER}']).decode()
    for filename in files_output.splitlines()[1:]:
        if filename.endswith('.json'):
          print('saving', filename)
          with open(os.path.join(tmp_dir, filename), 'wb') as f:
            content = subprocess.check_output(
                ['git', 'show', f'{revision}:{SEED_FOLDER}/{filename}'])
            f.write(content)

    subprocess.check_output(['npm', 'run', 'seed_tools', '--', 'create_seed',
                             tmp_dir, seed_path])


    seed = variations_seed_pb2.VariationsSeed()

    with open(seed_path, 'rb') as f:
      seed.ParseFromString(f.read())

    return seed


def make_field_trial_testing_config(seed, version_string, channel_string,
                                    target_date):
    target_version = serialize.version_to_int_array(version_string)
    target_channel = serialize.SUPPORTED_CHANNELS[channel_string]
    assert target_channel is not None
    config = {}
    for study in seed.study:
        json_study = {}
        min_version = (serialize.version_to_int_array(study.filter.min_version)
                       if study.filter.min_version else None)
        max_version = (serialize.version_to_int_array(study.filter.max_version)
                       if study.filter.max_version else None)

        if (study.filter.start_date and study.filter.start_date > target_date):
            print('skip ' + study.name + ' because of start_date')
            continue
        if (study.filter.end_date and study.filter.end_date < target_date):
            print('skip ' + study.name + ' because of end_date')
            continue
        if (min_version is not None and
            serialize.compare_versions(target_version, min_version)) < 0:
            print('skip ' + study.name + ' because of min_version')
            continue
        if (max_version is not None and
            serialize.compare_versions(target_version, max_version)) > 0:
            print('skip ' + study.name + ' because of max_version')
            continue
        if study.filter.channel and not target_channel in study.filter.channel:
            print('skip ' + study.name + ' because of channel')
            continue

        if study.filter.platform:
            json_study['platforms'] = \
              [PLATFORM_NAMES[x] for x in study.filter.platform]

        # Find an experiment with max probability_weight:
        best_experiment = max(
            study.experiment, key=lambda x: x.probability_weight)

        study_number = str(len(config) + 1)
        experiments_json = {}
        experiments_json['name'] = 'e' + study_number
        experiments_json['full_name'] = best_experiment.name

        params_json = {}
        for param in best_experiment.param:
            params_json[param.name] = param.value
        if params_json:
            experiments_json['params'] = params_json

        enable_features = best_experiment.feature_association.enable_feature
        if enable_features:
            experiments_json['enable_features'] = [x for x in enable_features]

        disable_features = best_experiment.feature_association.disable_feature
        if disable_features:
            experiments_json['disable_features'] = [x for x in disable_features]

        json_study['experiments'] = [experiments_json]
        json_study['full_name'] = study.name

        config['s' + study_number] = [json_study]
    return config


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
      '-o', '--output', type=argparse.FileType('w'), required=True,
      help='The path to write fieldtrial_testing_config.json'
           'See src/testing/variations/README.md for details')
    parser.add_argument(
      '--output-revision', type=argparse.FileType('w'), required=False,
      help='Save brave-variations revision to the provided file')
    parser.add_argument(
      '-ver', '--target-version', type=str, required=True,
      help='The browser version in format [chrome_major].[brave_version]'
           '(used to process filters)')
    parser.add_argument(
      '-c', '--target-channel', type=str, required=True,
      choices=serialize.SUPPORTED_CHANNELS.keys(),
      help='The browser channel (used to process filters)')
    parser.add_argument(
      '-d', '--target-date', type=str,
      help=('Take version seed_path on a specific date.'
            '"Format: "2022-09-09 10:02:27 +0000"'))
    args = parser.parse_args()

    date = datetime.strptime(args.target_date, '%Y-%m-%d %H:%M:%S %z')
    target_unix_time = date.timestamp()

    branch = 'main'
    if date < PRODUCTION_BRANCH_MIGRATION_DATE:
        branch = 'production-archive'

    revision = _get_variations_revision(args.target_date, branch)
    print('Load seed at', revision, 'from branch', branch)
    seed_message = _get_variations_seed(revision)

    if args.output_revision is not None:
      args.output_revision.write(revision)

    assert re.match(r'^\d+\.\d+\.\d+\.\d+$', args.target_version)
    json_config = make_field_trial_testing_config(
        seed_message, args.target_version, args.target_channel, target_unix_time)
    json.dump(json_config, args.output, indent=2)
    print("Testing config saved to", args.output.name)
    return 0

if __name__ == "__main__":
    sys.exit(main())
