import { BlockList, isIP } from "node:net";

const BLOCKED_IPV4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

// Inside global unicast, these carry or document other addresses.
const BLOCKED_IPV6: [string, number][] = [
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
];

const blocked = new BlockList();
BLOCKED_IPV4.forEach(([network, prefix]) => blocked.addSubnet(network, prefix, "ipv4"));
BLOCKED_IPV6.forEach(([network, prefix]) => blocked.addSubnet(network, prefix, "ipv6"));

const globalUnicast = new BlockList();
globalUnicast.addSubnet("2000::", 3, "ipv6");

/**
 * Whether our server may connect to an address. IPv6 is allowed only inside global unicast, which
 * also shuts out loopback, private, link-local, multicast, and IPv4 addresses written as IPv6.
 */
export function isPublicAddress(address: string) {
  switch (isIP(address)) {
    case 4:
      return !blocked.check(address, "ipv4");
    case 6:
      return globalUnicast.check(address, "ipv6") && !blocked.check(address, "ipv6");
    default:
      return false;
  }
}
