import { describe, expect, it } from "vitest";

import { isPublicAddress } from "./public-address";

describe("isPublicAddress", () => {
  it.each(["8.8.8.8", "93.184.216.34", "2606:4700:4700::1111", "2a00:1450:4001::200e"])(
    "allows %s",
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    },
  );

  it.each([
    ["this network", "0.1.2.3"],
    ["private, 10", "10.0.0.1"],
    ["carrier-grade NAT", "100.64.0.1"],
    ["loopback", "127.0.0.1"],
    ["loopback, far end", "127.255.255.254"],
    ["cloud metadata", "169.254.169.254"],
    ["private, 172", "172.16.0.1"],
    ["private, 172 top", "172.31.255.255"],
    ["IETF", "192.0.0.1"],
    ["documentation", "192.0.2.1"],
    ["private, 192", "192.168.1.1"],
    ["benchmarking", "198.18.0.1"],
    ["documentation", "198.51.100.1"],
    ["documentation", "203.0.113.1"],
    ["multicast", "224.0.0.1"],
    ["reserved", "240.0.0.1"],
    ["broadcast", "255.255.255.255"],
    ["IPv6 unspecified", "::"],
    ["IPv6 loopback", "::1"],
    ["IPv4 compatible", "::7f00:1"],
    ["IPv4 mapped loopback", "::ffff:127.0.0.1"],
    ["IPv4 mapped metadata", "::ffff:a9fe:a9fe"],
    ["NAT64", "64:ff9b::7f00:1"],
    ["discard", "100::1"],
    ["Teredo", "2001::1"],
    ["IPv6 documentation", "2001:db8::1"],
    ["6to4", "2002:7f00:1::"],
    ["unique local", "fc00::1"],
    ["unique local", "fd12:3456::1"],
    ["link-local", "fe80::1"],
    ["site-local", "fec0::1"],
    ["IPv6 multicast", "ff02::1"],
    ["not an address", "example.org"],
  ])("refuses %s: %s", (_name, address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
});
