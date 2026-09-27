import { isNegatedSpan } from '../src/services/clinical/croge';

// Test 1: Indonesian "no telp" preceding diagnosis separated by comma
const text1 = 'Pasien datang dengan no telp 08123456, riwayat hipertensi dan diabetes.';
const htnStart1 = text1.indexOf('hipertensi');
const htnEnd1 = htnStart1 + 'hipertensi'.length;
console.log('Test 1 (no telp): isNegatedSpan for hipertensi:', isNegatedSpan(text1, htnStart1, htnEnd1));

// Test 2: Indonesian "No. RM" preceding diagnosis separated by comma
const text2 = 'Pasien no rm 123456, riwayat hipertensi.';
const htnStart2 = text2.indexOf('hipertensi');
const htnEnd2 = htnStart2 + 'hipertensi'.length;
console.log('Test 2 (no rm): isNegatedSpan for hipertensi:', isNegatedSpan(text2, htnStart2, htnEnd2));

// Test 3: Actual English negation
const text3 = 'Patient has no hypertension.';
const htnStart3 = text3.indexOf('hypertension');
const htnEnd3 = htnStart3 + 'hypertension'.length;
console.log('Test 3 (actual English negation): isNegatedSpan for hypertension:', isNegatedSpan(text3, htnStart3, htnEnd3));
