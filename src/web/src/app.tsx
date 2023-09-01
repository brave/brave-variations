// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { variations as proto } from '../../proto/generated/proto_bundle';
import { type ProcessingOptions } from '../../core/core_utils';
import { type ExperimentModel, type FeatureModel, StudyModel } from './models';
import { useSearchParams } from 'react-router-dom';
import * as React from 'react';
enum SeedType {
  PRODUCTION,
  STAGING,
  UPSTREAM,
}

function stringToSeedType(value: string): SeedType | undefined {
  const index = Object.values(SeedType).indexOf(value);
  if (index >= 0) {
    return index as SeedType;
  }
  return undefined;
}

function processSeed(seedProtobufBytes: any, type: SeedType): StudyModel[] {
  const seedBytes = new Uint8Array(seedProtobufBytes);
  const seed = proto.VariationsSeed.decode(seedBytes);

  // TODO: get minMajorVersion when support UPSTREAM
  const options: ProcessingOptions = {
    isBraveSeed: type !== SeedType.UPSTREAM,
    minMajorVersion: 116,
  };
  return seed.study.map((study) => new StudyModel(study, options));
}

async function loadSeed(
  url: string,
  type: SeedType,
): Promise<StudyModel[] | undefined> {
  return await new Promise<StudyModel[] | undefined>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true /* async */);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => {
      resolve(processSeed(xhr.response, type));
    };
    xhr.onerror = (e) => {
      resolve(undefined);
    };
    xhr.send(null);
  });
}

export function FeatureItem(props: {
  feature: FeatureModel;
  style: string;
}): JSX.Element {
  if (props.feature.link !== '') {
    return (
      <a className={props.style} href={props.feature.link}>
        {props.feature.name}
      </a>
    );
  }
  return <a className={props.style}>{props.feature.name}</a>;
}

export function FeatureList(props: {
  title: string;
  style: string;
  features: FeatureModel[];
}): JSX.Element {
  if (props.features.length === 0) {
    return <></>;
  }
  const features = props.features.map((f) => (
    <li key={f.name}>
      <FeatureItem feature={f} style={props.style} />
    </li>
  ));
  return (
    <ul className="study-meta">
      <span>{props.title}: </span>
      {features}
    </ul>
  );
}

export function ExperimentItem(props: { exp: ExperimentModel }): JSX.Element {
  const paramsList = props.exp.parameters().map((p) => <li key={p}>{p}</li>);
  const paramsDiv =
    paramsList.length > 0 ? (
      <ul className="study-meta">
        <span>Parameters:</span>
        {paramsList}
      </ul>
    ) : (
      <></>
    );
  return (
    <li className="list-group-item">
      {props.exp.name()} ({props.exp.weight()}%)
      <FeatureList
        title="Enabled features"
        style="enabled-feature"
        features={props.exp.enabledFeatures()}
      />
      <FeatureList
        title="Disabled features"
        style="disabled-feature"
        features={props.exp.disabledFeatures()}
      />
      {paramsDiv}
    </li>
  );
}

export function StudyItem(props: { study: StudyModel }): JSX.Element {
  const contryList =
    props.study.countries().length > 0 ? (
      <ul className="study-meta">
        <span>Countries:</span>
        {props.study.countries().map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    ) : (
      <></>
    );

  return (
    <div className="card mb-3">
      <div className="card-header">{props.study.name()}</div>
      <div className="card-body">
        <ul className="list-group list-group-flush">
          {props.study.experiments().map((e) => (
            <ExperimentItem key={e.name()} exp={e} />
          ))}
        </ul>
      </div>
      <div className="card-footer">
        <ul className="study-meta">
          <span>Channels:</span>
          {props.study.channels().map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        {contryList}
        <ul className="study-meta">
          <span>Platforms:</span>
          {props.study.platforms().map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function getCurrentSeedType(searchParams: URLSearchParams): SeedType {
  return (
    stringToSeedType(searchParams.get('seed') ?? 'PRODUCTION') ??
    SeedType.PRODUCTION
  );
}

export function NavItem(props: { type: SeedType }): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentSeed = getCurrentSeedType(searchParams);
  const className =
    (props.type === currentSeed ? 'active ' : '') + 'nav-item nav-link btn-sm';
  const handleClick = (): void => {
    setSearchParams({ seed: SeedType[props.type] });
  };
  return (
    <a onClick={handleClick} className={className}>
      {SeedType[props.type]}
    </a>
  );
}

export function CurrentStudyList(props: {
  studies: Map<SeedType, StudyModel[]>;
}): JSX.Element {
  const [searchParams] = useSearchParams();
  const currentSeed = getCurrentSeedType(searchParams);
  const studyList = props.studies
    .get(currentSeed)
    ?.map((study, i) => <StudyItem key={study.name() + i} study={study} />);

  return (
    <div className="row">
      <div className="col-sm-12">{studyList}</div>
    </div>
  );
}

class AppState {
  studies = new Map<SeedType, StudyModel[]>();
}

export function App(): JSX.Element {
  const [state, setState] = React.useState(new AppState());
  React.useEffect(() => {
    const load = async (url: string, type: SeedType): Promise<void> => {
      const studyList = await loadSeed(url, type);
      setState((prevState) => {
        const newState = new AppState();
        newState.studies = prevState.studies;
        if (studyList !== undefined) newState.studies.set(type, studyList);
        return newState;
      });
    };
    const variationsProductionUrl = 'http://127.0.0.1:8000/production_seed';
    const variationsStagingUrl = 'http://127.0.0.1:8000/staging_seed';

    load(variationsProductionUrl, SeedType.PRODUCTION).catch(console.error);
    load(variationsStagingUrl, SeedType.STAGING).catch(console.error);
  }, []);

  const hasUpstream = state.studies.get(SeedType.UPSTREAM) !== undefined;
  const upstreamTab = hasUpstream ? (
    <NavItem type={SeedType.UPSTREAM} />
  ) : (
    <></>
  );
  return (
    <div className="container" id="app">
      <section className="navbar navbar-light bg-light">
        <h1>Brave Variations</h1>
        <nav className="nav nav-pills">
          <NavItem type={SeedType.PRODUCTION} />
          <NavItem type={SeedType.STAGING} />
          {upstreamTab}
        </nav>
      </section>
      <main>
        <CurrentStudyList studies={state.studies} />
      </main>
    </div>
  );
}
