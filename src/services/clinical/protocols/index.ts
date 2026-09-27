/**
 * internize.ai — Clinical Protocols & Knowledge Index
 *
 * Imports and auto-registers all 38 Sp.PD clinical protocols and 9 clinical scoring calculators.
 * 100% on-device, deterministic.
 */

// Import all protocol modules to trigger their registerProtocols() calls
import './preopProtocols';
import './emergencyProtocols';
import './infectiousProtocols';
import './rheumaProtocols';
import './miscProtocols';

// Export everything from protocolRegistry
export * from '../protocolRegistry';

// Export all scoring calculators
export * from './scoringCalculators';
