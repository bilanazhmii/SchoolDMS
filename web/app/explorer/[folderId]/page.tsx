import React from 'react';

import ExplorerShell from '../../../components/explorer-shell';
import ExplorerPage from '../../../components/explorer/ExplorerPage';

export default function Page({
  params,
}: {
  params: { folderId: string };
}) {
  return (
    <ExplorerShell>
      <ExplorerPage initialFolderId={params.folderId} />
    </ExplorerShell>
  );
}
