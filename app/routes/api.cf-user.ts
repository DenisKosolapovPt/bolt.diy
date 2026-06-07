import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';

const CLOUDFLARE_EMAIL_HEADERS = [
  'Cf-Access-Authenticated-User-Email',
  'CF-Access-Authenticated-User-Email',
  'cf-access-authenticated-user-email',
];

export async function loader({ request }: LoaderFunctionArgs) {
  const email =
    CLOUDFLARE_EMAIL_HEADERS.map((header) => request.headers.get(header)).find((value) => value?.trim()) ?? null;

  return json({ email });
}
