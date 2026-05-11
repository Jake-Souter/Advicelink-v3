/**
 * Brand bundle types — see REBUILD_PLAN.md §10.7.
 *
 * Tenants supply only `colours.brand.primary` and `colours.brand.accent` plus
 * the licensee/companyData/document chrome assets. All hover/pressed/contrast
 * variants are derived deterministically by `deriveBrandPalette`.
 */

export interface StorageKey {
  bucket?: string;
  key: string;
}

export interface BrandLogos {
  light: StorageKey;
  dark: StorageKey;
  mono: StorageKey;
  favicon: StorageKey;
}

export interface BrandColours {
  /** Primary brand colour as `#RRGGBB`. Used for active states and accents. */
  primary: string;
  /** Accent brand colour as `#RRGGBB`. Used for the chevron / illustration mark. */
  accent: string;
}

export interface BrandTypography {
  /** Body/sans font family name. Self-hosted or Google Fonts. */
  bodyFont: string;
  /** Heading/display font family name. */
  headingFont: string;
}

export interface DocumentChrome {
  headerImage?: StorageKey;
  footerImage?: StorageKey;
  coverPageImage?: StorageKey;
  letterheadImage?: StorageKey;
  /** A4 by default for AU. */
  pageSize: 'A4' | 'Letter';
}

export interface LicenseeAddress {
  street: string;
  suburb: string;
  state: string;
  postcode: string;
  country?: string;
}

export interface Licensee {
  name: string;
  abn: string;
  afsl: string;
  address: LicenseeAddress;
  website?: string;
  email?: string;
  phone?: string;
  fsgUrl?: string;
  ddoUrl?: string;
  privacyPolicyUrl?: string;
}

export interface CompanyData {
  name: string;
  abn: string;
  address: LicenseeAddress;
  website?: string;
  email?: string;
  phone?: string;
  logo?: StorageKey;
}

export interface BrandBundle {
  logos: BrandLogos;
  colours: BrandColours;
  typography: BrandTypography;
  documentChrome: DocumentChrome;
  licensee: Licensee;
  companyData: CompanyData;
}

export interface DerivedColourScale {
  base: string;
  hover: string;
  pressed: string;
  subtle: string;
  rowSelection: string;
  onBrand: string;
}
