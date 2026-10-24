import { describe, expect, it } from "vitest";
import { json } from "./response.js";
function createResponse() {
 const headers = new Map<string,string>(); let payload = "";
 const response = { statusCode: 200, setHeader(name:string,value:string){headers.set(name.toLowerCase(),value)}, end(value?:string){payload=value??""} };
 return {response,headers,body:()=>payload};
}
describe("secure JSON responses",()=>{
 it("sets no-store and browser hardening headers",()=>{
  const mock=createResponse(); json(mock.response as never,401,{error:"AUTH_REQUIRED"});
  expect(mock.response.statusCode).toBe(401);
  expect(mock.headers.get("content-type")).toBe("application/json; charset=utf-8");
  expect(mock.headers.get("cache-control")).toBe("no-store");
  expect(mock.headers.get("x-content-type-options")).toBe("nosniff");
  expect(mock.headers.get("x-frame-options")).toBe("DENY");
  expect(mock.headers.get("referrer-policy")).toBe("no-referrer");
  expect(JSON.parse(mock.body())).toEqual({error:"AUTH_REQUIRED"});
 });
 it("serializes untrusted strings as JSON data, not HTML",()=>{
  const mock=createResponse(); json(mock.response as never,200,{value:"<script>alert(1)</script>"});
  expect(mock.body()).toBe(JSON.stringify({value:"<script>alert(1)</script>"}));
  expect(mock.headers.get("content-type")).toContain("application/json");
 });
});
