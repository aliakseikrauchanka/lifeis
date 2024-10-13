// hook that return the value of the feature flag

import { useEffect, useState } from 'react';
import { useFlags } from 'flagsmith/react';

export const useFeatureFlags = (isUserLoggedIn: boolean, loggedInGoogleUserId: string) => {
  const { stt_feature, logs_feature, experiments_feature } = useFlags<
    'stt_feature' | 'logs_feature' | 'experiments_feature'
  >(['stt_feature', 'logs_feature', 'experiments_feature']);

  const [hasAudioFeature, setHasAudioFeature] = useState<any>(false);
  const [hasLogsFeature, setHasLogsFeature] = useState<any>(false);
  const [hasExperimentsFeature, setHasExperimentsFeature] = useState<any>(false);

  useEffect(() => {
    if (!isUserLoggedIn) {
      return;
    }

    const hasAudioFeatureInner =
      stt_feature.enabled &&
      loggedInGoogleUserId &&
      stt_feature.value &&
      JSON.parse(String(stt_feature.value)).indexOf(loggedInGoogleUserId) > -1;

    const hasLogsFeature =
      logs_feature.enabled &&
      loggedInGoogleUserId &&
      logs_feature.value &&
      JSON.parse(String(logs_feature.value)).indexOf(loggedInGoogleUserId) > -1;

    const hasExperimentsFeature =
      experiments_feature.enabled &&
      loggedInGoogleUserId &&
      experiments_feature.value &&
      JSON.parse(String(experiments_feature.value)).indexOf(loggedInGoogleUserId) > -1;

    setHasAudioFeature(hasAudioFeatureInner);
    setHasLogsFeature(hasLogsFeature);
    setHasExperimentsFeature(hasExperimentsFeature);
  }, [isUserLoggedIn, loggedInGoogleUserId, stt_feature, logs_feature, experiments_feature]);

  return {
    hasAudioFeature,
    hasExperimentsFeature,
    hasLogsFeature,
  };
};
