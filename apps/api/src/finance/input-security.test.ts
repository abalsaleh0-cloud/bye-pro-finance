import { describe, expect, it } from "vitest";
import { validateTransactionInput } from "./transactions.js";
import { validateBudgetInput } from "./budgets.js";
const accountId="123e4567-e89b-42d3-a456-426614174000";
const transaction={account_id:accountId,type:"expense",amount:12.5,currency_code:"LYD"};
const budget={name:"Food",amount:200,currency_code:"LYD",period:"monthly",start_date:"2026-10-01",end_date:"2026-10-31"};
describe("finance input security boundaries",()=>{
 it.each([null,undefined,[],"text",4])("rejects non-object transaction bodies: %s",(body)=>{
  expect(validateTransactionInput(body)).toMatchObject({ok:false,error:"INVALID_BODY"});
 });
 it("rejects oversized transaction references and descriptions",()=>{
  expect(validateTransactionInput({...transaction,reference:"x".repeat(201)})).toMatchObject({ok:false,error:"INVALID_REFERENCE"});
  expect(validateTransactionInput({...transaction,description:"x".repeat(2001)})).toMatchObject({ok:false,error:"INVALID_DESCRIPTION"});
 });
 it("rejects unknown statuses, currencies, and malformed metadata",()=>{
  expect(validateTransactionInput({...transaction,status:"posted"})).toMatchObject({ok:false,error:"INVALID_TRANSACTION_STATUS"});
  expect(validateTransactionInput({...transaction,currency_code:"US D"})).toMatchObject({ok:false,error:"INVALID_CURRENCY"});
  expect(validateTransactionInput({...transaction,metadata:"untrusted"})).toMatchObject({ok:false,error:"INVALID_METADATA"});
 });
 it.each([null,undefined,[],"text",4])("rejects non-object budget bodies: %s",(body)=>{
  expect(validateBudgetInput(body)).toMatchObject({ok:false,error:"INVALID_BODY"});
 });
 it("rejects whitespace-only and oversized budget names",()=>{
  expect(validateBudgetInput({...budget,name:"   " })).toMatchObject({ok:false,error:"INVALID_NAME"});
  expect(validateBudgetInput({...budget,name:"x".repeat(121)})).toMatchObject({ok:false,error:"INVALID_NAME"});
 });
});
