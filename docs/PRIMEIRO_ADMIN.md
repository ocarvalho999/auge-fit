# Como criar o primeiro admin

Não existe credencial fixa no código e o cadastro público sempre cria `student`. O primeiro admin é promovido uma única vez, por quem tem acesso ao banco.

1. Crie uma conta normalmente em `/cadastro` e confirme o e-mail.
2. No painel do Supabase, abra **SQL Editor** e rode, trocando o e-mail:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'SEU-EMAIL-AQUI');

insert into public.audit_logs (action, entity, entity_id, metadata)
select 'admin.bootstrap', 'profiles', id::text, '{"via": "sql_editor"}'::jsonb
from auth.users where email = 'SEU-EMAIL-AQUI';
```

3. Saia e entre de novo: você cairá em `/admin`.

O perfil de administrador não cria nem edita prescrições, não publica conteúdo técnico sem revisão e não vê fotos. Isso é garantido no banco.
