import React from 'react';

import ExplorerShell from '../../components/explorer-shell';
import ExplorerPage from '../../components/explorer/ExplorerPage';

export default function Page() {
  return (
    <ExplorerShell>
      <ExplorerPage />
    </ExplorerShell>
  );
}
