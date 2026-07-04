export type WPSiteConfig = {
  url: string;
  username: string;
  appPassword: string;
};

function authHeader(site: WPSiteConfig): string {
  const token = Buffer.from(`${site.username}:${site.appPassword}`).toString("base64");
  return `Basic ${token}`;
}

function wpFetch(site: WPSiteConfig, path: string, init?: RequestInit) {
  const url = `${site.url.replace(/\/$/, "")}/wp-json${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: authHeader(site),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export async function testWPConnection(
  site: WPSiteConfig
): Promise<{ ok: boolean; siteTitle?: string; error?: string }> {
  try {
    const res = await wpFetch(site, "/wp/v2/users/me");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: (body as { message?: string }).message || `HTTP ${res.status}` };
    }
    // Get site title from root
    const siteRes = await fetch(`${site.url.replace(/\/$/, "")}/wp-json`);
    const siteData = await siteRes.json().catch(() => ({}));
    return { ok: true, siteTitle: (siteData as { name?: string }).name };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Connection failed" };
  }
}

export async function createWPDraft(
  site: WPSiteConfig,
  options: { title: string; content?: string; type: "page" | "post" }
): Promise<{ id: number; link: string; editUrl: string }> {
  const endpoint = options.type === "page" ? "/wp/v2/pages" : "/wp/v2/posts";
  const res = await wpFetch(site, endpoint, {
    method: "POST",
    body: JSON.stringify({
      title: options.title,
      content: options.content ?? "",
      status: "draft",
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || `WP create failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { id: number; link: string; guid?: { rendered?: string } };
  const adminBase = site.url.replace(/\/$/, "");
  return {
    id: data.id,
    link: data.link,
    editUrl: `${adminBase}/wp-admin/post.php?post=${data.id}&action=edit`,
  };
}

export async function writeACFFields(
  site: WPSiteConfig,
  postId: number,
  type: "pages" | "posts",
  fields: Record<string, string>
): Promise<void> {
  // Try ACF REST API first (requires ACF Pro, or free ACF + "ACF to REST API" plugin)
  const acfRes = await wpFetch(site, `/acf/v3/${type}/${postId}`, {
    method: "POST",
    body: JSON.stringify({ fields }),
  });

  if (!acfRes.ok) {
    // Fallback: update via core REST API with acf key in the body
    const coreEndpoint = type === "pages" ? `/wp/v2/pages/${postId}` : `/wp/v2/posts/${postId}`;
    const coreRes = await wpFetch(site, coreEndpoint, {
      method: "POST",
      body: JSON.stringify({ acf: fields }),
    });
    if (!coreRes.ok) {
      const body = await coreRes.json().catch(() => ({}));
      throw new Error(
        (body as { message?: string }).message || `ACF write failed: HTTP ${coreRes.status}`
      );
    }
  }

  // WP returns 200 and silently drops unregistered ACF/REST fields instead of
  // erroring, so re-fetch and confirm the fields actually persisted.
  const verifyEndpoint = type === "pages" ? `/wp/v2/pages/${postId}` : `/wp/v2/posts/${postId}`;
  const verifyRes = await wpFetch(site, `${verifyEndpoint}?context=edit`);
  const verifyBody = (await verifyRes.json().catch(() => ({}))) as { acf?: unknown };
  const persistedAcf = (verifyBody.acf ?? {}) as Record<string, unknown>;
  const missingKeys = Object.keys(fields).filter(
    (key) => persistedAcf[key] === undefined || persistedAcf[key] === ""
  );
  if (missingKeys.length > 0) {
    throw new Error(
      `ACF fields did not persist (${missingKeys.join(", ")}). The target WP site likely needs ` +
        `ACF Pro (or the "ACF to REST API" plugin) and the field group's "Show in REST API" option enabled.`
    );
  }
}

export async function writeYoastMeta(
  site: WPSiteConfig,
  postId: number,
  type: "pages" | "posts",
  meta: { title: string; description: string }
): Promise<void> {
  const endpoint = type === "pages" ? `/wp/v2/pages/${postId}` : `/wp/v2/posts/${postId}`;
  await wpFetch(site, endpoint, {
    method: "POST",
    body: JSON.stringify({
      meta: {
        _yoast_wpseo_title: meta.title,
        _yoast_wpseo_metadesc: meta.description,
      },
    }),
  });

  // Same silent-drop risk as ACF: confirm the meta actually landed.
  const verifyRes = await wpFetch(site, `${endpoint}?context=edit`);
  const verifyBody = (await verifyRes.json().catch(() => ({}))) as { meta?: Record<string, unknown> };
  const persistedMeta = verifyBody.meta ?? {};
  if (
    persistedMeta._yoast_wpseo_title !== meta.title ||
    persistedMeta._yoast_wpseo_metadesc !== meta.description
  ) {
    throw new Error(
      "Yoast SEO meta did not persist. The target WP site likely needs the Yoast SEO plugin installed " +
        "with its meta fields registered for the REST API."
    );
  }
}
