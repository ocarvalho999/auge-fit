-- Auge Fit: bucket privado de fotos. Caminho {user_id}/{uuid}.webp. Admin sem acesso.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 10485760, array['image/webp'])
on conflict (id) do update set public = false;

create function public.photo_path_owner(p_name text) returns uuid
language plpgsql immutable set search_path = '' as $$
declare
  v_folder text := split_part(p_name, '/', 1);
begin
  if v_folder ~ '^[0-9a-fA-F-]{36}$' then
    return v_folder::uuid;
  end if;
  return null;
end;
$$;

create policy progress_photos_owner_select on storage.objects for select to authenticated
  using (
    bucket_id = 'progress-photos'
    and (
      public.photo_path_owner(name) = (select auth.uid())
      or public.professional_can_view_photos(public.photo_path_owner(name))
    )
  );
create policy progress_photos_owner_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'progress-photos'
    and public.photo_path_owner(name) = (select auth.uid())
    and public.has_consent((select auth.uid()), 'photos')
  );
create policy progress_photos_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and public.photo_path_owner(name) = (select auth.uid()));
