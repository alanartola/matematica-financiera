import type { PageProps } from '../registry';
import { SystemPage } from './SystemPage';

export default function Bullet(props: PageProps) {
  return <SystemPage {...props} system="bullet" compareWith="americano" />;
}
