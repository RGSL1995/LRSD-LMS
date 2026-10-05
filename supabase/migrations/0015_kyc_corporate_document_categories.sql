-- ============================================================
-- Additional document categories for the borrower review portal:
-- split KYC identity proof into Aadhaar (masked) / Passport / DL,
-- add a signed & stamped ITR category, and corporate registration
-- documents (MOA / AOA / MCA) for corporate-only applications.
-- ============================================================

alter type public.document_category add value if not exists 'aadhaar_masked';
alter type public.document_category add value if not exists 'passport';
alter type public.document_category add value if not exists 'driving_license';
alter type public.document_category add value if not exists 'itr_signed_stamped';
alter type public.document_category add value if not exists 'moa';
alter type public.document_category add value if not exists 'aoa';
alter type public.document_category add value if not exists 'mca_documents';
