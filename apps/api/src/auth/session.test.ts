import { describe, expect, it, vi } from "vitest";
import { verifyAccessToken, type UserLookup } from "./session.js";
describe("access token verification",()=>{
 it("fails closed when token or provider is missing",async()=>{
  const lookup:UserLookup=vi.fn(async()=>({id:"user-1",email:null}));
  expect(await verifyAccessToken("",lookup)).toBeNull();
  expect(await verifyAccessToken("token",null)).toBeNull();
  expect(lookup).not.toHaveBeenCalled();
 });
 it("returns only the verified identity from the provider",async()=>{
  const identity={id:"user-1",email:"user@example.com"};
  const lookup:UserLookup=vi.fn(async()=>identity);
  await expect(verifyAccessToken("valid-token",lookup)).resolves.toEqual(identity);
  expect(lookup).toHaveBeenCalledWith("valid-token");
 });
 it("fails closed on invalid sessions and provider exceptions",async()=>{
  expect(await verifyAccessToken("expired",async()=>null)).toBeNull();
  expect(await verifyAccessToken("bad",async()=>{throw new Error("network failure")})).toBeNull();
 });
});
