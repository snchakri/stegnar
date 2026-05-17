import sys
sys.path.insert(0, '/app')
import pcap_builder

# Simulate what a real captured packet looks like
# Test with a minimal HTTP response containing a JPEG magic
jpeg_magic = b'\xff\xd8\xff\xe0' + b'JFIF' + b'X' * 1000
http_resp = b'HTTP/1.1 200 OK\r\nContent-Type: image/jpeg\r\n\r\n' + jpeg_magic

# Simulate an IP+TCP header prefix (20 bytes IP + 20 bytes TCP = 40 bytes)
ip_tcp_header = bytes(40)
fake_packet = ip_tcp_header + http_resp

payload = pcap_builder._extract_tcp_payload(fake_packet)
print("Payload len:", len(payload))
print("First 20 bytes of payload:", payload[:20].hex())
carved = pcap_builder._carve_image_from_payloads(payload)
print("Carved len:", len(carved))

# Now test with actual IP/TCP headers (the real kind Scapy generates)
try:
    from scapy.all import IP, TCP, Raw
    pkt = IP(src="10.0.0.1", dst="10.0.0.2") / TCP(sport=12345, dport=80) / Raw(load=http_resp)
    raw_bytes = bytes(pkt)
    print("Real packet first byte:", hex(raw_bytes[0]))
    print("Real IHL:", (raw_bytes[0] & 0xF) * 4)
    tcp_payload = pcap_builder._extract_tcp_payload(raw_bytes)
    print("Real TCP payload len:", len(tcp_payload))
    print("Real TCP payload first 10:", tcp_payload[:10])
    carved2 = pcap_builder._carve_image_from_payloads(tcp_payload)
    print("Carved from real packet:", len(carved2))
except Exception as e:
    print("Scapy test failed:", e)
