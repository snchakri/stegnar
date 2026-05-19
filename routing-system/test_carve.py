import sys
import asyncio
sys.path.insert(0, '/app')
from pcap_builder import PcapBuilder

async def main():
    pb = PcapBuilder(output_dir="/tmp/test_pcaps")
    # Simulate what a real captured packet looks like
    jpeg_magic = b'\xff\xd8\xff\xe0' + b'JFIF' + b'X' * 1000
    http_resp = b'HTTP/1.1 200 OK\r\nContent-Type: image/jpeg\r\n\r\n' + jpeg_magic

    # Fake IP+TCP headers
    ip_tcp_header = bytes(40)
    fake_packet = ip_tcp_header + http_resp

    uri, carved = await pb.build_pcap("test-stream-1", fake_packet, "", is_list=True, pkt_list=[fake_packet])
    print("Test 1 - Carved len:", len(carved))
    print("Test 1 - URI:", uri)

    try:
        from scapy.all import IP, TCP, Raw
        pkt = IP(src="10.0.0.1", dst="10.0.0.2") / TCP(sport=12345, dport=80) / Raw(load=http_resp)
        raw_bytes = bytes(pkt)
        uri2, carved2 = await pb.build_pcap("test-stream-2", raw_bytes, "", is_list=True, pkt_list=[raw_bytes])
        print("Scapy test - Carved:", len(carved2))
        print("Scapy test - URI:", uri2)
    except Exception as e:
        print("Scapy test failed:", e)

if __name__ == "__main__":
    asyncio.run(main())
