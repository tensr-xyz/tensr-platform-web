import { DatasetContext, ColumnInfo } from '@/types/agent';

export interface PrivacyConfig {
  enablePIIDetection: boolean;
  enableDataMasking: boolean;
  enableSecureRouting: boolean;
  piiThreshold: number; // 0-1, confidence threshold for PII detection
  maskingStrategy: 'hash' | 'anonymize' | 'remove';
  allowedModels: string[];
  restrictedModels: string[];
  dataRetentionDays: number;
}

export interface PIIDetectionResult {
  columnName: string;
  piiType: PIIType;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  sampleValues: string[];
  recommendations: string[];
}

export interface DataMaskingResult {
  originalValue: string;
  maskedValue: string;
  maskingMethod: string;
  reversibility: 'reversible' | 'irreversible';
}

export interface SecurityAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  complianceStatus: ComplianceStatus;
  recommendations: string[];
}

export type PIIType =
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit_card'
  | 'address'
  | 'name'
  | 'date_of_birth'
  | 'ip_address'
  | 'mac_address'
  | 'license_plate'
  | 'passport'
  | 'drivers_license'
  | 'bank_account'
  | 'social_media'
  | 'medical_id'
  | 'unknown';

export interface RiskFactor {
  type: 'pii_exposure' | 'data_quality' | 'access_control' | 'encryption' | 'compliance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  mitigation: string;
}

export interface ComplianceStatus {
  gdpr: boolean;
  ccpa: boolean;
  hipaa: boolean;
  sox: boolean;
  pci: boolean;
  violations: string[];
}

export class DataPrivacyManager {
  private config: PrivacyConfig;
  private piiPatterns!: Map<PIIType, RegExp[]>;
  private sensitiveKeywords!: Set<string>;

  constructor(config: Partial<PrivacyConfig> = {}) {
    this.config = {
      enablePIIDetection: true,
      enableDataMasking: true,
      enableSecureRouting: true,
      piiThreshold: 0.7,
      maskingStrategy: 'anonymize',
      allowedModels: ['gpt-4o-mini', 'gpt-4o'],
      restrictedModels: ['gpt-4', 'claude-3.5-sonnet'],
      dataRetentionDays: 30,
      ...config,
    };

    this.initializePIIPatterns();
    this.initializeSensitiveKeywords();
  }

  /**
   * Initialize PII detection patterns
   */
  private initializePIIPatterns(): void {
    this.piiPatterns = new Map([
      ['email', [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/]],
      [
        'phone',
        [/^\+?1?[-.\s]?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/, /^\+?[0-9]{10,15}$/],
      ],
      ['ssn', [/^\d{3}-?\d{2}-?\d{4}$/, /^\d{9}$/]],
      ['credit_card', [/^\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}$/, /^\d{13,19}$/]],
      [
        'ip_address',
        [
          /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
          /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/,
        ],
      ],
      ['mac_address', [/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/]],
      [
        'date_of_birth',
        [
          /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/,
          /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
        ],
      ],
    ]);
  }

  /**
   * Initialize sensitive keywords for content analysis
   */
  private initializeSensitiveKeywords(): void {
    this.sensitiveKeywords = new Set([
      'password',
      'secret',
      'key',
      'token',
      'auth',
      'login',
      'credential',
      'confidential',
      'private',
      'restricted',
      'classified',
      'sensitive',
      'personal',
      'identity',
      'social',
      'security',
      'number',
      'ssn',
      'credit',
      'card',
      'bank',
      'account',
      'routing',
      'swift',
      'iban',
      'medical',
      'health',
      'diagnosis',
      'treatment',
      'prescription',
      'legal',
      'attorney',
      'lawyer',
      'case',
      'court',
      'judgment',
    ]);
  }

  /**
   * Scan dataset for PII
   */
  scanForPII(datasetContext: DatasetContext): PIIDetectionResult[] {
    if (!this.config.enablePIIDetection) {
      return [];
    }

    const results: PIIDetectionResult[] = [];

    datasetContext.schema.forEach(column => {
      const piiResult = this.analyzeColumnForPII(column, datasetContext.sampleData);
      if (piiResult) {
        results.push(piiResult);
      }
    });

    return results;
  }

  /**
   * Analyze individual column for PII
   */
  private analyzeColumnForPII(column: ColumnInfo, sampleData: any[]): PIIDetectionResult | null {
    const columnValues = sampleData
      .map(row => row[column.name])
      .filter(val => val !== null && val !== undefined);
    if (columnValues.length === 0) return null;

    let bestMatch: { type: PIIType; confidence: number } | null = null;

    // Check against PII patterns
    for (const [piiType, patterns] of this.piiPatterns) {
      const matchCount = columnValues.filter(value =>
        patterns.some(pattern => pattern.test(String(value)))
      ).length;

      const confidence = matchCount / columnValues.length;

      if (
        confidence > this.config.piiThreshold &&
        (!bestMatch || confidence > bestMatch.confidence)
      ) {
        bestMatch = { type: piiType, confidence };
      }
    }

    // Check for sensitive keywords in column name
    const columnNameLower = column.name.toLowerCase();
    const keywordMatch = Array.from(this.sensitiveKeywords).some(keyword =>
      columnNameLower.includes(keyword)
    );

    if (keywordMatch && !bestMatch) {
      bestMatch = { type: 'unknown', confidence: 0.6 };
    }

    if (!bestMatch) return null;

    const riskLevel = this.calculateRiskLevel(bestMatch.type, bestMatch.confidence, column);
    const recommendations = this.generatePIIRecommendations(bestMatch.type, riskLevel);

    return {
      columnName: column.name,
      piiType: bestMatch.type,
      confidence: bestMatch.confidence,
      riskLevel,
      sampleValues: columnValues.slice(0, 3),
      recommendations,
    };
  }

  /**
   * Calculate risk level for PII detection
   */
  private calculateRiskLevel(
    piiType: PIIType,
    confidence: number,
    column: ColumnInfo
  ): 'low' | 'medium' | 'high' | 'critical' {
    const piiRiskScores: Record<PIIType, number> = {
      ssn: 10,
      credit_card: 9,
      passport: 9,
      drivers_license: 8,
      bank_account: 8,
      medical_id: 8,
      email: 4,
      phone: 5,
      address: 6,
      name: 3,
      date_of_birth: 4,
      ip_address: 3,
      mac_address: 2,
      social_media: 3,
      license_plate: 4,
      unknown: 5,
    };

    const baseRisk = piiRiskScores[piiType] || 5;
    const confidenceMultiplier = confidence;
    const dataQualityMultiplier = column.missingPercentage < 10 ? 1.2 : 1.0;

    const riskScore = baseRisk * confidenceMultiplier * dataQualityMultiplier;

    if (riskScore >= 8) return 'critical';
    if (riskScore >= 6) return 'high';
    if (riskScore >= 4) return 'medium';
    return 'low';
  }

  /**
   * Generate recommendations for PII handling
   */
  private generatePIIRecommendations(
    piiType: PIIType,
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  ): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'critical' || riskLevel === 'high') {
      recommendations.push('Immediate action required - restrict access to this data');
      recommendations.push('Consider data anonymization or removal');
      recommendations.push('Implement strict access controls and audit logging');
    }

    if (piiType === 'ssn' || piiType === 'credit_card') {
      recommendations.push('Ensure PCI DSS compliance if processing payment data');
      recommendations.push('Implement end-to-end encryption');
    }

    if (piiType === 'medical_id' || (piiType as string) === 'medical') {
      recommendations.push('Ensure HIPAA compliance for healthcare data');
      recommendations.push('Implement data de-identification techniques');
    }

    recommendations.push('Review data retention policies');
    recommendations.push('Consider using secure model routing for sensitive data');

    return recommendations;
  }

  /**
   * Mask sensitive data values
   */
  maskSensitiveData(
    value: string,
    piiType: PIIType,
    strategy: 'hash' | 'anonymize' | 'remove' = 'anonymize'
  ): DataMaskingResult {
    if (!this.config.enableDataMasking) {
      return {
        originalValue: value,
        maskedValue: value,
        maskingMethod: 'none',
        reversibility: 'reversible',
      };
    }

    let maskedValue: string;
    let maskingMethod: string;
    let reversibility: 'reversible' | 'irreversible';

    switch (strategy) {
      case 'hash':
        maskedValue = this.hashValue(value);
        maskingMethod = 'sha256_hash';
        reversibility = 'irreversible';
        break;

      case 'anonymize':
        maskedValue = this.anonymizeValue(value, piiType);
        maskingMethod = 'anonymization';
        reversibility = 'irreversible';
        break;

      case 'remove':
        maskedValue = '[REDACTED]';
        maskingMethod = 'removal';
        reversibility = 'irreversible';
        break;

      default:
        maskedValue = value;
        maskingMethod = 'none';
        reversibility = 'reversible';
    }

    return {
      originalValue: value,
      maskedValue,
      maskingMethod,
      reversibility,
    };
  }

  /**
   * Hash value using SHA-256
   */
  private hashValue(value: string): string {
    // In production, use a proper cryptographic hash function
    // This is a simplified version for demonstration
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `hash_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Anonymize value based on PII type
   */
  private anonymizeValue(value: string, piiType: PIIType): string {
    switch (piiType) {
      case 'email':
        const [localPart, domain] = value.split('@');
        return `${localPart.charAt(0)}***@${domain}`;

      case 'phone':
        return value.replace(/\d(?=\d{4})/g, '*');

      case 'ssn':
        return `***-**-${value.slice(-4)}`;

      case 'credit_card':
        return `****-****-****-${value.slice(-4)}`;

      case 'address':
        const parts = value.split(' ');
        return `${parts[0]} *** ${parts[parts.length - 1]}`;

      case 'name':
        const names = value.split(' ');
        return names.map(name => name.charAt(0) + '*'.repeat(name.length - 1)).join(' ');

      case 'date_of_birth':
        return 'MM/DD/YYYY';

      case 'ip_address':
        const octets = value.split('.');
        return `${octets[0]}.${octets[1]}.*.*`;

      default:
        return value.length > 3 ? `${value.charAt(0)}***${value.charAt(value.length - 1)}` : '***';
    }
  }

  /**
   * Assess overall security of dataset
   */
  assessSecurity(
    datasetContext: DatasetContext,
    piiResults: PIIDetectionResult[]
  ): SecurityAssessment {
    const riskFactors: RiskFactor[] = [];
    let overallRiskScore = 0;

    // PII exposure risk
    const criticalPII = piiResults.filter(r => r.riskLevel === 'critical');
    const highPII = piiResults.filter(r => r.riskLevel === 'high');

    if (criticalPII.length > 0) {
      overallRiskScore += 10;
      riskFactors.push({
        type: 'pii_exposure',
        severity: 'critical',
        description: `${criticalPII.length} columns contain critical PII`,
        impact: 'High risk of data breach and compliance violations',
        mitigation: 'Immediate data masking and access restriction required',
      });
    }

    if (highPII.length > 0) {
      overallRiskScore += 5;
      riskFactors.push({
        type: 'pii_exposure',
        severity: 'high',
        description: `${highPII.length} columns contain high-risk PII`,
        impact: 'Significant privacy and compliance risks',
        mitigation: 'Implement data masking and review access controls',
      });
    }

    // Data quality risk
    if (datasetContext.dataQuality.overall < 70) {
      overallRiskScore += 3;
      riskFactors.push({
        type: 'data_quality',
        severity: 'medium',
        description: 'Low data quality score',
        impact: 'May lead to incorrect analysis and poor decisions',
        mitigation: 'Improve data preprocessing and validation',
      });
    }

    // Access control risk (placeholder)
    riskFactors.push({
      type: 'access_control',
      severity: 'low',
      description: 'Access control assessment needed',
      impact: 'Potential unauthorized access to sensitive data',
      mitigation: 'Implement role-based access controls and audit logging',
    });

    // Determine overall risk level
    let overallRisk: 'low' | 'medium' | 'high' | 'critical';
    if (overallRiskScore >= 15) overallRisk = 'critical';
    else if (overallRiskScore >= 10) overallRisk = 'high';
    else if (overallRiskScore >= 5) overallRisk = 'medium';
    else overallRisk = 'low';

    // Compliance assessment
    const complianceStatus = this.assessCompliance(piiResults);

    // Generate recommendations
    const recommendations = this.generateSecurityRecommendations(riskFactors, complianceStatus);

    return {
      overallRisk,
      riskFactors,
      complianceStatus,
      recommendations,
    };
  }

  /**
   * Assess compliance with various regulations
   */
  private assessCompliance(piiResults: PIIDetectionResult[]): ComplianceStatus {
    const hasFinancialData = piiResults.some(
      r => r.piiType === 'credit_card' || r.piiType === 'bank_account'
    );
    const hasHealthData = piiResults.some(r => r.piiType === 'medical_id');
    const hasPersonalData = piiResults.some(r =>
      ['name', 'email', 'phone', 'address', 'ssn'].includes(r.piiType)
    );

    const violations: string[] = [];

    // GDPR compliance
    const gdprCompliant = hasPersonalData ? this.config.dataRetentionDays <= 30 : true;
    if (!gdprCompliant) violations.push('GDPR: Data retention exceeds 30 days');

    // CCPA compliance
    const ccpaCompliant = hasPersonalData;
    if (!ccpaCompliant) violations.push('CCPA: Personal data processing without consent');

    // HIPAA compliance
    const hipaaCompliant = !hasHealthData || this.config.enableDataMasking;
    if (!hipaaCompliant) violations.push('HIPAA: Health data not properly protected');

    // SOX compliance
    const soxCompliant = !hasFinancialData || this.config.enableDataMasking;
    if (!soxCompliant) violations.push('SOX: Financial data not properly secured');

    // PCI compliance
    const pciCompliant = !hasFinancialData || this.config.enableDataMasking;
    if (!pciCompliant) violations.push('PCI DSS: Payment data not properly secured');

    return {
      gdpr: gdprCompliant,
      ccpa: ccpaCompliant,
      hipaa: hipaaCompliant,
      sox: soxCompliant,
      pci: pciCompliant,
      violations,
    };
  }

  /**
   * Generate security recommendations
   */
  private generateSecurityRecommendations(
    riskFactors: RiskFactor[],
    complianceStatus: ComplianceStatus
  ): string[] {
    const recommendations: string[] = [];

    // High-risk recommendations
    if (riskFactors.some(r => r.severity === 'critical')) {
      recommendations.push('IMMEDIATE ACTION REQUIRED: Restrict access to critical PII data');
      recommendations.push('Implement emergency data masking procedures');
    }

    // Compliance recommendations
    if (complianceStatus.violations.length > 0) {
      recommendations.push('Address compliance violations immediately');
      recommendations.push('Review and update data handling policies');
    }

    // General security recommendations
    recommendations.push('Implement role-based access controls');
    recommendations.push('Enable comprehensive audit logging');
    recommendations.push('Regular security assessments and penetration testing');
    recommendations.push('Employee security training and awareness programs');

    return recommendations;
  }

  /**
   * Determine secure model routing based on data sensitivity
   */
  determineSecureModelRouting(
    piiResults: PIIDetectionResult[],
    userQuery: string,
    datasetContext: DatasetContext
  ): {
    recommendedModel: string;
    reasoning: string;
    securityLevel: 'standard' | 'enhanced' | 'restricted';
    requiresApproval: boolean;
  } {
    if (!this.config.enableSecureRouting) {
      return {
        recommendedModel: this.config.allowedModels[0],
        reasoning: 'Secure routing disabled',
        securityLevel: 'standard',
        requiresApproval: false,
      };
    }

    // Assess query sensitivity
    const querySensitivity = this.assessQuerySensitivity(userQuery);

    // Assess data sensitivity
    const criticalPII = piiResults.filter(r => r.riskLevel === 'critical');
    const highPII = piiResults.filter(r => r.riskLevel === 'high');

    let securityLevel: 'standard' | 'enhanced' | 'restricted' = 'standard';
    let recommendedModel = this.config.allowedModels[0];
    let reasoning = 'Standard security level';
    let requiresApproval = false;

    // Determine security level
    if (criticalPII.length > 0 || querySensitivity === 'high') {
      securityLevel = 'restricted';
      recommendedModel = this.config.restrictedModels[0];
      reasoning = 'Critical PII detected or high-sensitivity query';
      requiresApproval = true;
    } else if (highPII.length > 0 || querySensitivity === 'medium') {
      securityLevel = 'enhanced';
      recommendedModel = this.config.allowedModels[1] || this.config.allowedModels[0];
      reasoning = 'High-risk PII detected or medium-sensitivity query';
      requiresApproval = false;
    }

    return {
      recommendedModel,
      reasoning,
      securityLevel,
      requiresApproval,
    };
  }

  /**
   * Assess query sensitivity
   */
  private assessQuerySensitivity(query: string): 'low' | 'medium' | 'high' {
    const queryLower = query.toLowerCase();

    // High sensitivity keywords
    const highSensitivityKeywords = [
      'password',
      'secret',
      'key',
      'token',
      'credential',
      'social security',
      'ssn',
      'credit card',
      'bank account',
      'medical',
      'health',
      'diagnosis',
      'treatment',
    ];

    // Medium sensitivity keywords
    const mediumSensitivityKeywords = [
      'personal',
      'identity',
      'address',
      'phone',
      'email',
      'financial',
      'income',
      'salary',
      'tax',
      'legal',
    ];

    if (highSensitivityKeywords.some(keyword => queryLower.includes(keyword))) {
      return 'high';
    }

    if (mediumSensitivityKeywords.some(keyword => queryLower.includes(keyword))) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Update privacy configuration
   */
  updateConfig(newConfig: Partial<PrivacyConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current privacy configuration
   */
  getConfig(): PrivacyConfig {
    return { ...this.config };
  }

  /**
   * Export privacy report
   */
  exportPrivacyReport(
    datasetContext: DatasetContext,
    piiResults: PIIDetectionResult[],
    securityAssessment: SecurityAssessment
  ): {
    summary: string;
    piiFindings: PIIDetectionResult[];
    securityAssessment: SecurityAssessment;
    recommendations: string[];
    complianceStatus: ComplianceStatus;
  } {
    const summary = `Privacy scan completed for dataset with ${datasetContext.totalRows} rows and ${datasetContext.totalColumns} columns. Found ${piiResults.length} potential PII columns. Overall security risk: ${securityAssessment.overallRisk}.`;

    const recommendations = [
      ...securityAssessment.recommendations,
      ...piiResults.flatMap(r => r.recommendations),
    ];

    return {
      summary,
      piiFindings: piiResults,
      securityAssessment,
      recommendations: [...new Set(recommendations)], // Remove duplicates
      complianceStatus: securityAssessment.complianceStatus,
    };
  }
}

// Export singleton instance
export const dataPrivacyManager = new DataPrivacyManager();

// Export convenience functions
export const scanForPII = (datasetContext: DatasetContext) =>
  dataPrivacyManager.scanForPII(datasetContext);

export const maskSensitiveData = (
  value: string,
  piiType: PIIType,
  strategy?: 'hash' | 'anonymize' | 'remove'
) => dataPrivacyManager.maskSensitiveData(value, piiType, strategy);

export const assessSecurity = (datasetContext: DatasetContext, piiResults: PIIDetectionResult[]) =>
  dataPrivacyManager.assessSecurity(datasetContext, piiResults);

export const determineSecureModelRouting = (
  piiResults: PIIDetectionResult[],
  userQuery: string,
  datasetContext: DatasetContext
) => dataPrivacyManager.determineSecureModelRouting(piiResults, userQuery, datasetContext);
