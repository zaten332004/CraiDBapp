/**
 * Danh mục bảng tham chiếu cho CRAI DB (phân tích rủi ro tín dụng / star schema).
 * Hệ thống không đọc schema Power BI trực tiếp tại màn cấu hình — người dùng tự đối chiếu trong semantic model.
 */
export const POWER_BI_REFERENCE_DIMENSION_TABLES: readonly string[] = [
  'DimAccount',
  'DimCurrency',
  'DimDate',
  'DimGeography',
  'DimScenario',
];

export const POWER_BI_REFERENCE_FACT_TABLES: readonly string[] = [
  'FactCurrencyRate',
  'FactFinance',
  'FactInternetSales',
];

/** Danh mục chuẩn (dimension + fact) dùng làm mặc định cho gợi ý tên bảng trên màn Power BI. */
export const POWER_BI_DEFAULT_TABLE_SUGGESTIONS: readonly string[] = [
  ...POWER_BI_REFERENCE_DIMENSION_TABLES,
  ...POWER_BI_REFERENCE_FACT_TABLES,
];

/** Gợi ý mở rộng thường gặp trong mô hình rủi ro tín dụng / danh mục — có thể điều chỉnh theo nội bộ. */
export const POWER_BI_REFERENCE_EXTENDED_TABLES: readonly string[] = [
  'DimCustomer',
  'DimBranch',
  'DimProduct',
  'FactLoanPortfolio',
  'FactCollateralRegister',
  'FactCreditExposure',
];
