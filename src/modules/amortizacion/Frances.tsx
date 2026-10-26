import type { PageProps } from '../registry';
import { SystemPage } from './SystemPage';

export default function Frances(props: PageProps) {
  return <SystemPage {...props} system="frances" compareWith="aleman" />;
}
