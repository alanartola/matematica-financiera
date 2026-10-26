import type { PageProps } from '../registry';
import { SystemPage } from './SystemPage';

export default function Americano(props: PageProps) {
  return <SystemPage {...props} system="americano" compareWith="frances" />;
}
