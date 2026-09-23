"""Keep source publication dates distinct from unrelated event/page dates."""

import json
import unittest
from unittest.mock import patch

import run_daily


class SourceDateTests(unittest.TestCase):
    def test_unix_epoch_placeholder_is_not_a_publication_date(self):
        self.assertEqual(run_daily.parse_date("Thu, 01 Jan 1970 00:00:00 GMT"), "")
        self.assertEqual(run_daily.normalize_source_date("19700101"), "")
        self.assertEqual(run_daily.normalize_source_date("1970-01-01"), "")

    def test_official_english_news_index_date_is_not_event_date(self):
        source = {"id": "wako_news", "label": "Wako official news", "company_id": "wako",
                  "url": "https://example.org/us/news/index.html",
                  "include_url_terms": ["/us/news/"], "english_news_index_dates": True}
        index = ('<a href="/us/news/041410.html">Sep. 17, 2025 Featured '
                 'RiboNAT rapid sterility test for cell therapy</a>')
        with patch.object(run_daily, "fetch_text", return_value=index):
            items = run_daily.parse_html_links(source)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].published, "2025-09-17")
        self.assertEqual(items[0].publication_date_evidence, "dated_news_index_link")
        self.assertEqual(run_daily.extract_leading_english_news_date(
            "ISSCR 2026 scheduled for July 8-11, 2026"), "")

    def test_official_new_product_index_trailing_date(self):
        source = {"id": "nacalai_products", "label": "Nacalai official new products",
                  "company_id": "nacalai", "url": "https://example.org/news/new/",
                  "include_url_terms": ["/products/"], "trailing_news_index_dates": True}
        index = ('<a href="/products/403">新製品 mRNA 医薬品開発の評価などに '
                 '抗 Double stranded RNA 抗体 2025.06.16</a>')
        with patch.object(run_daily, "fetch_text", return_value=index):
            items = run_daily.parse_html_links(source)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].published, "2025-06-16")
        self.assertEqual(items[0].publication_date_evidence, "dated_news_index_link")

    def test_official_dl_date_is_scoped_to_its_own_news_link(self):
        source = {"id": "noile_news", "label": "Noile official news", "company_id": "noile",
                  "url": "https://example.org/en/news.html", "associated_rss_date_dt": True,
                  "include_url_terms": [".pdf"]}
        index = ('<div class="rss_box">'
                 '<dl><dt class="rss_date">2026/08/28</dt><dd class="rss_title">'
                 '<a href="/news/first.pdf">PRIME CAR-T study published</a></dd></dl>'
                 '<dl><dt class="rss_date">2024/06/28</dt><dd class="rss_title">'
                 '<a href="/news/second.pdf">Pipeline update</a></dd></dl></div>')
        with patch.object(run_daily, "fetch_text", return_value=index):
            items = run_daily.parse_html_links(source)
        self.assertEqual([item.published for item in items], ["2026-08-28", "2024-06-28"])
        self.assertTrue(all(item.publication_date_evidence == "dated_news_index_associated_dt"
                            for item in items))

    def test_official_list_item_news_date_matches_pdf_link(self):
        source = {"id": "kidswell_news", "label": "Kidswell official news", "company_id": "kidswell",
                  "url": "https://example.org/en/topics/", "associated_newsdate_p": True,
                  "include_url_terms": ["/topics/"]}
        index = ('<li><p class="newsDate">2026/08/12</p><div class="newsTitle">'
                 '<a href="/Portals/0/Topics/2026/story.pdf">SHED safety study update</a>'
                 '</div></li><li><p class="newsDate">2019/05/10</p><div class="newsTitle">'
                 '<a href="/Portals/0/Topics/2019/old.pdf">Historical partnership</a>'
                 '</div></li>')
        with patch.object(run_daily, "fetch_text", return_value=index):
            items = run_daily.parse_html_links(source)
        self.assertEqual([item.published for item in items], ["2026-08-12", "2019-05-10"])
        self.assertTrue(all(item.publication_date_evidence == "dated_news_index_associated_p"
                            for item in items))

    def test_full_english_month_at_official_news_link_start(self):
        source = {"id": "aska_news", "label": "ASKA official news", "company_id": "aska",
                  "url": "https://example.org/english/news/", "english_news_index_dates": True,
                  "include_url_terms": ["filedownload.php"]}
        index = ('<a href="/english/news/filedownload.php?name=x.pdf">June 22 2026 '
                 'ASKA phase 3 result</a>')
        with patch.object(run_daily, "fetch_text", return_value=index):
            items = run_daily.parse_html_links(source)
        self.assertEqual(items[0].published, "2026-06-22")
        self.assertEqual(items[0].publication_date_evidence, "dated_news_index_link")

    def test_official_archive_card_pubdate_scoped_to_story(self):
        source = {"id": "reprocell_news", "label": "REPROCELL official news",
                  "company_id": "reprocell", "url": "https://example.org/news/all",
                  "include_url_terms": ["/news/"], "archive_news_pubdate": True}
        index = ('<div class="news-item-archive"><h2><a href="/news/first">'
                 'First research update</a></h2><div class="news-pubdate t-coolblue">'
                 '27 July 2026</div></div>'
                 '<div class="news-item-archive"><h2><a href="/news/second">'
                 'Second research update</a></h2><div class="news-pubdate">'
                 '15 August 2025</div></div>')
        with patch.object(run_daily, "fetch_text", return_value=index):
            items = run_daily.parse_html_links(source)
        self.assertEqual([item.published for item in items], ["2026-07-27", "2025-08-15"])
        self.assertTrue(all(item.publication_date_evidence == "verified_news_archive_pubdate"
                            for item in items))
        items[0].signal_type = "event"
        fields = run_daily.candidate_date_fields(items[0])
        self.assertEqual(fields["published_at"], "2026-07-27")
        self.assertEqual(fields["event_start_at"], "")

    def test_official_blog_card_pubdate_without_datetime(self):
        source = {"id": "luca_news", "label": "LUCA Science official news",
                  "company_id": "luca_science", "url": "https://example.org/news-release",
                  "include_url_terms": ["/news-release/"], "blog_article_pubdate": True}
        index = ('<article class="entry blog-item"><a href="/news-release/260403-01">'
                 'Clinical update</a><time class="blog-date" pubdate>4/3/26</time></article>'
                 '<article class="entry blog-item"><a href="/news-release/210407-01">'
                 'Old Oxford collaboration</a><time pubdate>4/7/21</time></article>')
        with patch.object(run_daily, "fetch_text", return_value=index):
            items = run_daily.parse_html_links(source)
        self.assertEqual([item.published for item in items], ["2026-04-03", "2021-04-07"])
        self.assertTrue(all(item.publication_date_evidence == "verified_blog_card_pubdate"
                            for item in items))

    def test_official_ir_year_heading_and_card_month_day(self):
        source = {"id": "kubota_ir", "label": "Kubota official IR news",
                  "company_id": "kubota_pharma", "url": "https://example.org/en/ir/presentations/index.html",
                  "include_url_terms": ["/en/ir/docs/"], "ir_news_index_dates": True}
        index = ('<h4 class="u-fw-b">2026</h4><div class="p-itemlist__item" data-year="2016">'
                 '<div><span class="p-itemlist__itemDate">04/22</span></div>'
                 '<div><a href="../docs/2026.pdf">Phase 3 clinical update</a></div></div>'
                 '<h4 class="u-fw-b">2025</h4><div class="p-itemlist__item" data-year="2016">'
                 '<div><span class="p-itemlist__itemDate">12/22</span></div>'
                 '<div><a href="../docs/2025.pdf">Old clinical update</a></div></div>')
        with patch.object(run_daily, "fetch_text", return_value=index):
            items = run_daily.parse_html_links(source)
        self.assertEqual([item.published for item in items], ["2026-04-22", "2025-12-22"])
        self.assertTrue(all(item.publication_date_evidence == "verified_ir_news_index_date"
                            for item in items))

    def test_explicit_article_meta_wins_over_event_time(self):
        html = ('<meta property="article:published_time" content="2026-09-14">'
                '<time class="event-date" datetime="2026-10-20"></time>')
        self.assertEqual(run_daily.extract_article_publication_date(html),
                         ("2026-09-14", "article_published_meta"))

    def test_unrelated_json_ld_and_plain_time_do_not_supply_publication(self):
        html = ('<script type="application/ld+json">'
                '{"@type":"Event","datePublished":"2026-09-14","startDate":"2026-10-20"}'
                '</script><time datetime="2026-10-20">event</time>')
        self.assertEqual(run_daily.extract_article_publication_date(html), ("", ""))

    def test_article_json_ld_and_marked_time_are_valid(self):
        html = ('<script type="application/ld+json">'
                '{"@type":"https://schema.org/NewsArticle","datePublished":"2026-09-14"}'
                '</script>')
        self.assertEqual(run_daily.extract_article_publication_date(html),
                         ("2026-09-14", "article_jsonld_datePublished"))
        self.assertEqual(run_daily.extract_article_publication_date(
            '<time itemprop="datePublished" datetime="2026-09-13"></time>'),
            ("2026-09-13", "article_time_datetime"))
        self.assertEqual(run_daily.extract_article_publication_date(
            '<time class="date" itemprop="datePublished">2025.12.26</time>'),
            ("2025-12-26", "article_time_datePublished_text"))

    def test_detail_title_does_not_promote_first_body_date(self):
        source = {
            "id": "example_official", "label": "Example official news", "company_id": "example",
            "url": "https://example.com/news/", "include_url_terms": ["/news/"],
            "follow_detail_titles": True,
        }
        index = '<a href="/news/story">Read more</a>'
        detail = '<h1>Example company announces a new partnership</h1><p>Event begins 2026-10-20.</p>'
        with patch.object(run_daily, "fetch_text", side_effect=[index, detail]):
            items = run_daily.parse_html_links(source)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].published, "")
        self.assertEqual(items[0].publication_date_evidence, "")

    def test_verified_news_date_line_is_separate_from_event_date(self):
        source = {"id": "nacalai_official_news_links", "label": "Official news",
                  "company_id": "nacalai_tesque", "url": "https://www.nacalai.co.jp/news/news/",
                  "include_url_terms": ["/news/news/"], "follow_detail_dates": True,
                  "detail_date_pattern": '<div class="date">\\s*([^<]+)'}
        index = '<a href="/news/news/LADEC2026-20260617.html">LADEC 2026 session</a>'
        detail = '<div class="date">2026.06.17</div><p>Session: 2026-07-03</p>'
        with patch.object(run_daily, "fetch_text", side_effect=[index, detail]), \
                patch.object(run_daily, "source_allows_candidate", return_value=True):
            items = run_daily.parse_html_links(source)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].published, "2026-06-17")
        self.assertEqual(items[0].publication_date_evidence, "verified_article_date_line")
        items[0].signal_type = "event"
        fields = run_daily.candidate_date_fields(items[0])
        self.assertEqual(fields["published_at"], "2026-06-17")
        self.assertEqual(fields["event_start_at"], "")
        self.assertEqual(fields["publication_date_status"], "known")

    def test_event_listing_date_without_publication_evidence_is_not_news_date(self):
        item = run_daily.Candidate("example", "official_events", "Official events", "owned",
                                   "Conference session", "https://example.com/events/session",
                                   published="2026-10-20", signal_type="event")
        fields = run_daily.candidate_date_fields(item)
        self.assertEqual(fields["published_at"], "")
        self.assertEqual(fields["event_start_at"], "2026-10-20")
        self.assertEqual(fields["publication_date_status"], "unknown")

    def test_official_news_event_index_date_is_publication_not_event(self):
        source = {"id": "wako_seminars", "label": "Wako official news seminars",
                  "company_id": "wako", "url": "https://example.org/jp/news/seminar/index.html",
                  "include_url_terms": ["/jp/seminar/"],
                  "dated_news_index_links": True, "signal_type": "event"}
        index = ('<a href="/jp/seminar/043437.html"><time>2026.09.07</time> '
                 'セミナー・展示 9月29日開催のバイオサイエンスセミナー</a>')
        with patch.object(run_daily, "fetch_text", return_value=index):
            item = run_daily.parse_html_links(source)[0]
        self.assertEqual(item.published, "2026-09-07")
        self.assertEqual(item.publication_date_evidence, "dated_news_index_link")
        fields = run_daily.candidate_date_fields(item)
        self.assertEqual(fields["published_at"], "2026-09-07")
        self.assertEqual(fields["event_start_at"], "")

    def test_official_dated_pdf_link_is_publication_date(self):
        source = {"id": "interprotein_news", "label": "Interprotein official news",
                  "company_id": "interprotein", "url": "http://www.interprotein.com/irnews.html",
                  "include_url_terms": ["/news_pdf/"], "date_from_dated_pdf_url": True}
        index = ('<table><tr><td class="head">Aug.08,2022</td>'
                 '<td><a href="news_pdf/20220808-e.pdf">'
                 'Interprotein announced a research agreement with SANWA KAGAKU</a></td></tr></table>')
        with patch.object(run_daily, "fetch_text", return_value=index):
            item = run_daily.parse_html_links(source)[0]
        self.assertEqual(item.published, "2022-08-08")
        self.assertEqual(item.publication_date_evidence, "dated_official_news_pdf_url")
        self.assertEqual(run_daily.candidate_date_fields(item)["published_at"], "2022-08-08")

    def test_index_title_date_is_not_a_publication_date(self):
        source = {"id": "example_official", "label": "Example official news",
                  "url": "https://example.com/news/", "include_url_terms": ["/news/"]}
        index = '<a href="/news/story">Partnership event starts 2026-10-20</a>'
        with patch.object(run_daily, "fetch_text", return_value=index):
            items = run_daily.parse_html_links(source)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].published, "")

    def test_announcement_api_date_field_is_traceable(self):
        source = {"id": "official_json", "label": "Official JSON",
                  "url": "https://example.com/api/news", "company_id": "example"}
        payload = {"item": [{"anndate": "20260914",
                             "contents": '<a href="/news.pdf">Example announces a new study</a>'}]}
        with patch.object(run_daily, "fetch_text", return_value=json.dumps(payload)), \
                patch.object(run_daily, "source_allows_candidate", return_value=True):
            items = run_daily.parse_json_announcements(source)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].published, "2026-09-14")
        self.assertEqual(items[0].publication_date_evidence, "announcement_api_date_field")

    def test_sitemap_lastmod_does_not_become_publication_date(self):
        source = {"id": "sitemap", "label": "Official sitemap",
                  "url": "https://example.com/sitemap.xml", "company_id": "example"}
        sitemap = ('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
                   '<url><loc>https://example.com/news/story</loc>'
                   '<lastmod>2026-09-14</lastmod></url></urlset>')
        with patch.object(run_daily, "fetch_text", return_value=sitemap), \
                patch.object(run_daily, "source_allows_candidate", return_value=True):
            items, _, runtime = run_daily.parse_sitemap_urls(source, {"keys": ["previous"]})
        self.assertEqual(len(items), 1)
        self.assertEqual(runtime["new_urls"], 1)
        self.assertEqual(items[0].published, "")

    def test_youtube_relative_age_does_not_become_publication_date(self):
        source = {"id": "official_video", "label": "Official video",
                  "url": "https://youtube.com/example", "company_id": "example"}
        payload = {"lockupViewModel": {
            "contentType": "LOCKUP_CONTENT_TYPE_VIDEO", "contentId": "abc123",
            "metadata": {"lockupMetadataViewModel": {
                "title": {"content": "Example company launches a new assay"},
                "metadata": {"contentMetadataViewModel": {
                    "metadataRows": [{"metadataParts": [{"text": {"content": "2 weeks ago"}}]}]
                }}
            }}
        }}
        with patch.object(run_daily, "fetch_text", return_value="var ytInitialData = " + json.dumps(payload)), \
                patch.object(run_daily, "source_allows_candidate", return_value=True):
            items = run_daily.parse_youtube_channel(source)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].published, "")
        self.assertIn("2 weeks ago", items[0].summary)

    def test_unicode_detail_url_is_percent_encoded_for_request(self):
        with patch.object(run_daily.urllib.request, "urlopen") as open_url:
            response = open_url.return_value.__enter__.return_value
            response.headers.get_content_charset.return_value = "utf-8"
            response.read.return_value = b"ok"
            self.assertEqual(run_daily.fetch_text("https://example.com/news/χ-detail.html?q=抗体"), "ok")
        request = open_url.call_args.args[0]
        self.assertEqual(request.full_url, "https://example.com/news/%CF%87-detail.html?q=%E6%8A%97%E4%BD%93")

    def test_peptidream_ir_index_noise_is_not_an_effective_signal(self):
        config = run_daily.load_json(run_daily.ROOT / "config" / "priority_account_monitoring.json")
        source = next(source for account in config["accounts"] for source in account["sources"]
                      if source["id"] == "peptidream_official_ir_blog")
        noise = run_daily.Candidate("peptidream", source["id"], source["label"], "owned",
                                    "FTSE JPX Blossom Japan Indexの構成銘柄に継続選定",
                                    "https://www.peptidream.com/ir/blog/000648.html")
        science = run_daily.Candidate("peptidream", source["id"], source["label"], "owned",
                                      "放射性医薬品の開発と製造に関する研究セミナー",
                                      "https://www.peptidream.com/ir/blog/000655.html")
        self.assertFalse(run_daily.source_allows_candidate(source, noise))
        self.assertTrue(run_daily.source_allows_candidate(source, science))


if __name__ == "__main__":
    unittest.main()
