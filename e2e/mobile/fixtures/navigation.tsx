import type { AnchorHTMLAttributes } from 'react';

export const usePathname = () => window.location.pathname;
export const useRouter = () => ({
  push: (url: string) => window.location.assign(url),
  refresh: () => {},
});
export default function Link(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} />;
}
