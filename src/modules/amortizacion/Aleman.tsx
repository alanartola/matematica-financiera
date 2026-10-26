import type { PageProps } from '../registry';
import { SystemPage } from './SystemPage';

export default function Aleman(props: PageProps) {
  return <SystemPage {...props} system="aleman" compareWith="frances" />;
}
