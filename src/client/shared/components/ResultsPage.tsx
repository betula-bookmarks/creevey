import React, { useState, useEffect } from 'react';
import { ImagesView } from './ImagesView/ImagesView';
import { PageHeader } from './PageHeader/PageHeader';
import { PageFooter } from './PageFooter/PageFooter';
import { getImageUrl } from '../helpers';
import { styled, withTheme, Theme } from '@storybook/theming';
import { Placeholder } from '@storybook/components';
import { getViewMode, VIEW_MODE_KEY } from '../viewMode';
import { ImagesViewMode, TestResult } from '../../../types';

interface TestResultsProps {
  id: string;
  path: string[];
  results?: TestResult[];
  approved?: Partial<{ [image: string]: number }>;
  showTitle?: boolean;
  onImageApprove: (id: string, retry: number, image: string) => void;
  theme: Theme;
}

const Wrapper = styled.div({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
});

const ImagesViewContainer = styled.div(({ theme }) => ({
  background: theme.background.content,
  height: '100%',
}));

const FooterContainer = styled.div({
  position: 'sticky',
  bottom: 0,
  zIndex: 1,
});

export function ResultsPageInternal({
  id,
  path,
  results = [],
  approved = {},
  theme,
  onImageApprove,
  showTitle = false,
}: TestResultsProps): JSX.Element {
  const [retry, setRetry] = useState(results.length);
  const result = results[retry - 1] ?? {};
  const [imageName, setImageName] = useState(Object.keys(result.images ?? {})[0] ?? '');
  const [viewMode, setViewMode] = useState<ImagesViewMode>(getViewMode());

  useEffect(() => setRetry(results.length), [results.length]);

  const url = getImageUrl([...path].reverse(), imageName);
  const image = result.images?.[imageName];
  const canApprove = Boolean(image && approved[imageName] != retry - 1 && result.status != 'success');
  const hasDiffAndExpect = canApprove && Boolean(image?.diff && image.expect);
  const imagesWithError = result.images
    ? Object.keys(result.images).filter(
        (imageName) =>
          result.status != 'success' &&
          approved[imageName] != retry - 1 &&
          (result.images || {})[imageName]?.error != null,
      )
    : [];

  const handleApprove = (): void => onImageApprove(id, retry - 1, imageName);
  const handleChangeViewMode = (mode: ImagesViewMode): void => {
    localStorage.setItem(VIEW_MODE_KEY, mode);
    setViewMode(mode);
  };

  return (
    <Wrapper>
      <PageHeader
        title={path}
        images={result.images}
        errorMessage={result.error}
        showViewModes={hasDiffAndExpect}
        viewMode={viewMode}
        onViewModeChange={handleChangeViewMode}
        onImageChange={setImageName}
        showTitle={showTitle}
        imagesWithError={imagesWithError}
      />
      <ImagesViewContainer theme={theme}>
        {image ? (
          <ImagesView url={url} image={image} canApprove={canApprove} mode={viewMode} />
        ) : (
          <Placeholder>{`Image ${imageName} not found`}</Placeholder>
        )}
      </ImagesViewContainer>
      {results.length ? (
        <FooterContainer>
          <PageFooter
            canApprove={canApprove}
            retry={retry}
            retriesCount={results.length}
            onRetryChange={setRetry}
            onApprove={handleApprove}
          />
        </FooterContainer>
      ) : null}
    </Wrapper>
  );
}

export const ResultsPage = withTheme(ResultsPageInternal);
