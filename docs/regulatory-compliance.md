# Regulatory Compliance — India LoRa & Wireless

## Summary

Cortexion uses LoRa (SX1278) for V2V communication in the **IN865 (865–867 MHz)** and **433 MHz** bands, both license-exempt in India under DoT/WPC rules.

## Frequency Bands

### ✅ Legal in India

| Band | Regulation | Power Limit | Duty Cycle | Notes |
|------|-----------|-------------|------------|-------|
| **865–867 MHz (IN865)** | WPC license-exempt | 30 dBm (1W) | 1% per hour | Primary LoRaWAN band for India. Three mandatory channels: 865.0625, 865.4025, 865.985 MHz |
| **433 MHz (433.05–434.79 MHz)** | WPC license-exempt | 10 mW e.r.p. | Varies | Lower power limit. Most cheap SX1278 boards default to this band. Bandwidth restrictions may limit standard 125 kHz LoRa modulation. |

### ❌ NOT Legal in India

| Band | Region | Why You'll See It in Tutorials |
|------|--------|-------------------------------|
| 868 MHz | EU (ETSI) | Most English-language LoRa tutorials are EU-authored |
| 915 MHz | US (FCC) | Most Arduino/LoRa YouTube content is US-based |
| 923 MHz | Asia-Pacific | Used in Japan, Korea, etc. — not India |

> **Critical note:** Using a 915 MHz or 868 MHz module in India is illegal, even if the tutorial you followed says it works. This is the most common regulatory mistake in student LoRa projects.

## Cortexion Implementation

### Duty Cycle Enforcement

The `DutyCycleGuard` class in firmware enforces the 1% duty cycle limit programmatically:

```cpp
class DutyCycleGuard {
  uint32_t windowStartMs = 0, airtimeUsedMs = 0;
  static const uint32_t WINDOW_MS = 3600000;  // 1 hour
  static const uint32_t BUDGET_MS = 36000;    // 1% of 1 hour
public:
  bool canTransmit(uint32_t estAirtimeMs);
  void recordTransmit(uint32_t actualMs);
};
```

### Airtime Budget Analysis

| Scenario | SF | Packet Size | Airtime | Interval | Hourly Airtime | % of Budget |
|----------|-----|-------------|---------|----------|---------------|-------------|
| Moving (V2V safety) | SF7 | 21 bytes | ~30ms | 500ms | ~216s | 6% ⚠️ |
| Stationary (range demo) | SF11 | 21 bytes | ~200ms | 1000ms | ~720s | 20% ⚠️ |

> At 2 Hz with SF7, hourly airtime is ~216 seconds (6%). This is within the 1% limit per-transmission but approaches it in sustained operation. The firmware TX interval should be 1 Hz (1000ms) for sustained use, with 2 Hz reserved for short safety-critical bursts.

### Equipment Type Approval (ETA)

For any commercial or production deployment:
- Devices operating in the 865–867 MHz band require WPC **Equipment Type Approval (ETA)**
- The ETA-Self Declaration (ETA-SD) process is available for license-exempt bands
- For a research/educational prototype, explicit ETA is not required, but should be mentioned as a roadmap item

## References

- WPC/DoT: Search "IN865 LoRaWAN India" for current gazette notification
- India 433 MHz: "WPC 865-867 MHz exemption rules"
- Telecommunications Act, 2023 and subsequent 2026 Authorisation Rules
