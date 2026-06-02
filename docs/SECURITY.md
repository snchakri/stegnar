# Security Policy

The security of the Stegnar platform is of paramount importance. This document outlines our security policy, including threat modeling and procedures for reporting vulnerabilities.

## 1. Threat Model

We have identified several potential threat vectors and have implemented mitigations to address them.

### 1.1. Malicious Payload Execution

-   **Threat:** An adversary crafts a malicious media file (e.g., a "zip bomb" disguised as an image or a file that exploits a vulnerability in a media parsing library) and introduces it into the network. If the analysis worker attempts to process this file without proper sandboxing, it could lead to resource exhaustion or arbitrary code execution within the worker container.
-   **Mitigation:**
    1.  **Sandboxing:** All analysis is performed inside Docker containers, which provide a layer of isolation from the host system.
    2.  **Minimal Privileges:** Containers are run with the minimum necessary privileges. They do not run as root, and their capabilities are restricted.
    3.  **Resource Limits:** The `stegnar-mitm` workers are configured with strict CPU and memory limits in the `docker-compose.yml` file to prevent a single malicious file from causing a denial of service by consuming all available resources.
    4.  **Input Validation:** The `soc-api` performs initial validation on ingested files to check for basic conformity to the expected file types.

### 1.2. Inference Cache Poisoning

-   **Threat:** An adversary who has gained a foothold in the network could potentially attempt to "poison" the analysis cache. For example, they could repeatedly submit a known malicious file that has been slightly modified to produce a different hash, causing the system to waste resources analyzing variants of the same threat.
-   **Mitigation:**
    1.  **Rate Limiting:** The `routing-system` implements rate limiting on a per-source-IP basis to prevent a single actor from overwhelming the analysis queue.
    2.  **Intelligent Deduplication:** The caching mechanism is designed to be more sophisticated than a simple hash lookup. It considers factors such as the time since the last analysis and the confidence of the result.
    3.  **Zero Trust Architecture:** Services do not implicitly trust each other. Communication between services is authenticated, and access to the data layer is strictly controlled.

### 1.3. Man-in-the-Middle (MITM) Attack on Internal Communication

-   **Threat:** An attacker on the internal network could attempt to intercept or modify the communication between the microservices, for example, by altering the analysis results being sent from the `stegnar-mitm` gateway to the `data-layer`.
-   **Mitigation:**
    1.  **Network Segmentation:** The services are deployed on a dedicated Docker network, which provides a degree of isolation from the wider network.
    2.  **Encrypted Communication (Future):** While the current implementation uses unencrypted communication between services for simplicity, a production deployment would require the use of TLS to encrypt all internal traffic.
    3.  **Signed Results (Future):** Analysis results could be cryptographically signed by the `stegnar-mitm` workers to ensure their integrity.

## 2. Vulnerability Reporting

We take all security vulnerabilities seriously. If you discover a security vulnerability, please follow the procedure below.

1.  **Do not disclose the vulnerability publicly.**
2.  **Email us:** Send an email to `security@your-org.com` with the subject line "Security Vulnerability in Stegnar Prototype".
3.  **Provide details:** In your email, please include:
    -   A detailed description of the vulnerability.
    -   Steps to reproduce the vulnerability.
    -   Any proof-of-concept code.
    -   Your name and contact information.
4.  **Our commitment:**
    -   We will acknowledge receipt of your report within 48 hours.
    -   We will investigate the vulnerability and work to provide a fix.
    -   We will keep you informed of our progress.
    -   We will publicly credit you for your discovery (unless you prefer to remain anonymous).

We appreciate your efforts to help us keep the Stegnar platform secure.

