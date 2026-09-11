// mfe-gateway — HOST/SHELL. Không chứa business UI.
// Source of truth của từng plugin nằm ở plugins/<code>/frontend/src,
// được sync vào src/_plugins/<code> bởi scripts/sync-plugins.mjs
// (chạy ở prebuild/predev + trong Dockerfile).
import { AssetModuleApp } from '../_plugins/asset-module/App';
import { assetMeta } from '../_plugins/asset-module/meta';
import { CrmModuleApp } from '../_plugins/crm-module/App';
import { crmMeta } from '../_plugins/crm-module/meta';
import { HrModuleApp } from '../_plugins/hr-module/App';
import { hrMeta } from '../_plugins/hr-module/meta';
import { FinanceModuleApp } from '../_plugins/finance-module/App';
import { financeMeta } from '../_plugins/finance-module/meta';
import { ProjectModuleApp } from '../_plugins/project-module/App';
import { projectMeta } from '../_plugins/project-module/meta';
import { DocumentModuleApp } from '../_plugins/document-module/App';
import { documentMeta } from '../_plugins/document-module/meta';
import { MeetingModuleApp } from '../_plugins/meeting-module/App';
import { meetingMeta } from '../_plugins/meeting-module/meta';
import { ProcurementModuleApp } from '../_plugins/procurement-module/App';
import { procurementMeta } from '../_plugins/procurement-module/meta';
import { ItHelpdeskModuleApp } from '../_plugins/it-helpdesk-module/App';
import { itHelpdeskMeta } from '../_plugins/it-helpdesk-module/meta';

export interface PluginEntry {
  code: string;
  displayName: string;
  description: string;
  ready: boolean;
  render: (props: { subPath: string; navigate: (sub: string) => void }) => JSX.Element;
}

export const registry: PluginEntry[] = [
  {
    code: assetMeta.code,
    displayName: assetMeta.displayName,
    description: assetMeta.description,
    ready: true,
    render: (p) => <AssetModuleApp {...p} />,
  },
  {
    code: crmMeta.code,
    displayName: crmMeta.displayName,
    description: crmMeta.description,
    ready: true,
    render: (p) => <CrmModuleApp {...p} />,
  },
  {
    code: hrMeta.code,
    displayName: hrMeta.displayName,
    description: hrMeta.description,
    ready: true,
    render: (p) => <HrModuleApp {...p} />,
  },
  {
    code: financeMeta.code,
    displayName: financeMeta.displayName,
    description: financeMeta.description,
    ready: true,
    render: (p) => <FinanceModuleApp {...p} />,
  },
  {
    code: projectMeta.code,
    displayName: projectMeta.displayName,
    description: projectMeta.description,
    ready: true,
    render: (p) => <ProjectModuleApp {...p} />,
  },
  {
    code: documentMeta.code,
    displayName: documentMeta.displayName,
    description: documentMeta.description,
    ready: true,
    render: (p) => <DocumentModuleApp {...p} />,
  },
  {
    code: meetingMeta.code,
    displayName: meetingMeta.displayName,
    description: meetingMeta.description,
    ready: true,
    render: (p) => <MeetingModuleApp {...p} />,
  },
  {
    code: procurementMeta.code,
    displayName: procurementMeta.displayName,
    description: procurementMeta.description,
    ready: true,
    render: (p) => <ProcurementModuleApp {...p} />,
  },
  {
    code: itHelpdeskMeta.code,
    displayName: itHelpdeskMeta.displayName,
    description: itHelpdeskMeta.description,
    ready: true,
    render: (p) => <ItHelpdeskModuleApp {...p} />,
  },
];
