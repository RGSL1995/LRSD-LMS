-- ============================================================
-- Adds Legal Entity Identifier (LEI) certificate as a corporate
-- document category in the borrower review portal.
-- ============================================================

alter type public.document_category add value if not exists 'lei_certificate';
