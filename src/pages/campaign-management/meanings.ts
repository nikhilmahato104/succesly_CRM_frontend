// Plain-language meaning of every term shown on the campaign pages.
// Rendered by <InfoTip> (the eye icon) — keep each entry to one or two sentences.

export const MEANINGS = {
  // Links
  short_link:    "The link you share. Opening it records a click, then sends the visitor to the destination with your UTM tags added.",
  path_link:     "Same short link in path form (/r/<name>). Use it until wildcard DNS for the short domain is set up — it works with no DNS change.",
  destination:   "The page you entered, without UTM tags.",
  redirects_to:  "The final page visitors land on: destination URL + UTM parameters + custom params. Google Analytics reads the UTM tags from here.",
  qr_code:       "Scan to open the short link. Switch between Short and Path to choose which link the QR code points to, then download it as PNG for posters or print.",
  short_name:    "The part before the domain, e.g. iphone17-diwali → iphone17-diwali.succesly.in. Lowercase letters, numbers and single hyphens. Leave empty for a random 6-character name.",

  // UTM
  utm:                 "UTM tags tell Google Analytics where a visit came from. Source, Medium and Campaign are required; the rest are optional.",
  utm_source:          "Where the traffic comes from — instagram, facebook, google, newsletter.",
  utm_medium:          "The marketing channel type — social, cpc, email, banner.",
  utm_campaign:        "The campaign name — diwali_sale_2026.",
  utm_term:            "Paid-search keyword — iphone+17.",
  utm_content:         "Which ad / creative / A-B variant was clicked — story_ad_v2.",
  utm_id:              "Campaign ID in the ad platform — cmp_123.",
  utm_source_platform: "The buying platform — meta_ads, google_ads.",
  custom_params:       "Extra non-UTM query params added to the destination, e.g. ref=abc. Up to 5.",

  // Schedule
  status:        "Active: the link redirects. Paused: the link sends visitors to the fallback URL (or a 'link inactive' page) and clicks are not counted.",
  fallback_url:  "Where visitors go when the link is paused, expired or not started yet.",
  schedule:      "Before the start date or after the expiry date, the link behaves like a paused link.",

  // Metrics
  total_clicks:    "Every human click on the short link in this period. Bots are excluded unless 'Include bots' is on.",
  unique_clicks:   "First click from each browser on this campaign. A visitor who opens the link 5 times counts once here.",
  unique_visitors: "Number of different browsers that clicked in this period (tracked with an anonymous cookie, no login needed).",
  bot_hits:        "Link-preview bots (WhatsApp, Facebook, Slack), crawlers and tools like curl / Postman. Stored, but kept out of the numbers.",
  last_click:      "When the most recent human click happened.",
  campaigns:       "Live (non-archived) campaigns, and how many of them are active right now.",
  timeline:        "Clicks per hour / day / week / month. Solid line = all clicks, dashed line = unique clicks.",
  device:          "Mobile, tablet or desktop, detected from the browser's user agent.",
  browser:         "Browser that opened the link. In-app browsers (Instagram, Facebook) are shown separately.",
  os:              "Operating system of the visitor's device.",
  referrer:        "The site the visitor came from. 'direct' means no referrer — typed, scanned from a QR code, or opened from an app that hides it.",
  country:         "From the CDN geo headers (Cloudflare / Vercel / CloudFront). 'unknown' when the server is not behind one.",
  city:            "From the CDN geo headers. 'unknown' when the server is not behind Cloudflare / Vercel / CloudFront.",
  hour_of_day:     "Which hours of the day get the most clicks, in your local time — useful for picking when to post.",
  day_of_week:     "Which weekdays get the most clicks.",
  link_type:       "Subdomain = clicked the short link (name.succesly.in). Path = clicked the /r/<name> link.",
  click_log:       "Every recorded hit, newest first, including bots. New = first click from that browser, Returning = clicked before.",
  by_industry:     "Clicks grouped by the campaign's industry — compare which verticals perform best.",
  by_utm_source:   "Clicks grouped by utm_source — compare channels like instagram vs facebook.",
  by_utm_medium:   "Clicks grouped by utm_medium — compare social vs email vs cpc.",
  by_utm_campaign: "Clicks grouped by utm_campaign name.",
  top_campaigns:   "The 10 most-clicked campaigns in the selected period.",
  by_industry_table: "All-time totals per industry for live campaigns, with the average clicks per campaign.",
} as const;

export type MeaningKey = keyof typeof MEANINGS;
