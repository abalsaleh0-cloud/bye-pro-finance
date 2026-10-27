-- Communication security hardening: membership checks are internal to authenticated flows only.
revoke execute on function public.is_conversation_participant(uuid, uuid) from public;
revoke execute on function public.is_conversation_participant(uuid, uuid) from anon;
grant execute on function public.is_conversation_participant(uuid, uuid) to authenticated;
