-- Communication security hardening: keep conversation membership helper private to authenticated users.
revoke execute on function public.is_conversation_participant(uuid, uuid) from anon;
