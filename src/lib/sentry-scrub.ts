// Sem dados pessoais, de saúde, fotos ou tokens no Sentry.

/** No Sentry 11, o padrão é coletar tudo isto. Desligamos cada item; o filtro abaixo é a segunda barreira. */
export const SENTRY_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
};

type ScrubbableEvent = {
  user?: unknown;
  request?: { data?: unknown; cookies?: unknown; headers?: unknown; query_string?: unknown; url?: string };
  extra?: unknown;
  breadcrumbs?: unknown;
};

const SENSITIVE = /[\w.+-]+@[\w-]+\.[\w.-]+|eyJ[\w-]+\.[\w-]+\.[\w-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export const scrubText = (text: string) => text.replace(SENSITIVE, "[removido]");

export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  delete event.user;
  delete event.extra;
  delete event.breadcrumbs;
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.query_string;
    if (event.request.url) event.request.url = scrubText(event.request.url.split("?")[0] ?? "");
  }
  return event;
}
