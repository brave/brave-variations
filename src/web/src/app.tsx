// Copyright (c) 2023 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

import { variations as proto } from '../../proto/generated/proto_bundle';
import * as core_utils from '../../core/core_utils';
import {
  type ExperimentModel,
  type FeatureModel,
  type StudyModel,
  StudyListModel,
  SeedType,
  stringToSeedType,
} from './models';
import { useSearchParams } from 'react-router-dom';
import * as React from 'react';
import { StudyFilter } from '../../core/study_processor';


async function processSeed(
  seedProtobufBytes: any,
  type: SeedType,
): Promise<StudyListModel | undefined> {
  const seedBytes = new Uint8Array(seedProtobufBytes);
  const seed = proto.VariationsSeed.decode(seedBytes);

  const isBraveSeed = type !== SeedType.UPSTREAM;
  let currentMajorVersion = 0;
  if (!isBraveSeed) {
    const chromeVersionData = await loadFile(
      core_utils.kGetUsedChromiumVersion,
      'text',
    );
    currentMajorVersion = chromeVersionData.split('.')[0] ?? 0;
  }
  const options: core_utils.ProcessingOptions = {
    minMajorVersion: currentMajorVersion,
  };
  return new StudyListModel(seed.study, options, type);
}

async function loadFile(
  url: string,
  responseType: 'arraybuffer' | 'text',
): Promise<any | undefined> {
  return await new Promise<any | undefined>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true /* async */);
    xhr.responseType = responseType;
    xhr.onload = () => {
      resolve(xhr.response);
    };
    xhr.onerror = () => {
      resolve(undefined);
    };
    xhr.send(null);
  });
}

async function loadSeed(
  url: string,
  type: SeedType,
): Promise<StudyListModel | undefined> {
  const data = await loadFile(url, 'arraybuffer');
  if (data === undefined) return undefined;
  return await processSeed(data, type);
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
        <span>Parameters: </span>
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

export function PropertyList(props: {
  caption: string;
  list: string[] | null | undefined;
}): JSX.Element {
  if (props.list == null || props.list.length === 0) return <></>;
  return (
    <ul className="study-meta">
      <span>{props.caption}: </span>
      {props.list.map((c) => (
        <li key={c}>{c}</li>
      ))}
    </ul>
  );
}

export function IncludeExcludeList(props: {
  caption: string;
  include: string[] | null | undefined;
  exclude: string[] | null | undefined;
}): JSX.Element {
  return (
    <>
      <PropertyList caption={props.caption} list={props.include} />
      <PropertyList caption={'Exclude' + props.caption} list={props.exclude} />
    </>
  );
}

export function StudyItem(props: {
  study: StudyModel;
  filter: StudyFilter;
}): JSX.Element {
  const filter = props.study.filter();
  return (
    <div className="card mb-3">
      <div className="card-header">{props.study.name()}</div>
      <div className="card-body">
        <ul className="list-group list-group-flush">
          {props.study.experiments(props.filter).map((e) => (
            <ExperimentItem key={e.name()} exp={e} />
          ))}
        </ul>
      </div>
      <div className="card-footer">
        <PropertyList caption="Channels" list={props.study.channels()} />
        <PropertyList caption="Platforms" list={props.study.platforms()} />
        <IncludeExcludeList
          caption="Countries"
          include={filter?.country}
          exclude={filter?.exclude_country}
        />
        <IncludeExcludeList
          caption="Hardware class"
          include={filter?.hardware_class}
          exclude={filter?.exclude_hardware_class}
        />
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
    setSearchParams((prev) => {
      prev.set('seed', SeedType[props.type]);
      return prev;
    });
  };
  return (
    <a onClick={handleClick} className={className}>
      {SeedType[props.type]}
    </a>
  );
}

export function FilterCheckbox(props: {
  title: string;
  htmlName: string;
  checked: boolean;
  toggle: () => void;
}): JSX.Element {
  return (
    <div className="filter">
      <input
        type="checkbox"
        id={props.htmlName}
        checked={props.checked}
        onChange={props.toggle}
      />
      <label htmlFor={props.htmlName}>{props.title}</label>
    </div>
  );
}

export function CurrentStudyList(props: {
  studies: Map<SeedType, StudyListModel>;
}): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const setParam = (param: string, value: string): void => {
    setSearchParams((prev) => {
      prev.set(param, value);
      return prev;
    });
  };

  const filter = new StudyFilter();
  filter.nameFilter = searchParams.get('name') ?? undefined;
  filter.search = searchParams.get('search') ?? undefined;

  filter.showEmptyGroups = searchParams.get('showEmptyGroups') === 'true';
  const toggleShowEmptyGroups = (): void => {
    setParam('showEmptyGroups', filter.showEmptyGroups ? 'false' : 'true');
  };

  filter.includeOutdated = searchParams.get('includeOutdated') === 'true';
  const toggleIncludeOutdated = (): void => {
    setParam('includeOutdated', filter.includeOutdated ? 'false' : 'true');
  };

  const currentSeed = getCurrentSeedType(searchParams);
  const studyList = props.studies
    .get(currentSeed)
    ?.studies(filter)
    .map((study, i) => (
      <StudyItem key={study.name() + i} study={study} filter={filter} />
    ));

  return (
    <div className="row">
      <div className="col-sm-12">
        <div className="card mb-3">
          <div className="card-header filter-list">
            <FilterCheckbox
              title="Show empty groups"
              htmlName="showEmptyGroups"
              checked={filter.showEmptyGroups}
              toggle={toggleShowEmptyGroups}
            />
            <FilterCheckbox
              title="Show outdated studies"
              htmlName="includeOutdated"
              checked={filter.includeOutdated}
              toggle={toggleIncludeOutdated}
            />
          </div>
        </div>
        {studyList}
      </div>
    </div>
  );
}

class AppState {
  studies = new Map<SeedType, StudyListModel>();
}

export function App(): JSX.Element {
  const [state, setState] = React.useState(new AppState());
  React.useEffect(() => {
    const load = async (url: string, type: SeedType): Promise<void> => {
      const studyList = await loadSeed(url, type);
      setState((prevState) => {
        const newState: AppState = { ...prevState };
        if (studyList !== undefined) newState.studies.set(type, studyList);
        return newState;
      });
    };
    load(core_utils.variationsProductionUrl, SeedType.PRODUCTION).catch(
      console.error,
    );
    load(core_utils.variationsStagingUrl, SeedType.STAGING).catch(
      console.error,
    );
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
