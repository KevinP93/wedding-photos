const { getAuthenticatedUser, getProfileById, getServiceSupabase } = require('./_supabase');
const { buildNotificationPayload, configureWebPush, sendPushToSubscriptions } = require('./_push');

function parseBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === 'string') {
    return JSON.parse(req.body);
  }

  return req.body;
}

async function fetchSubscriptions(client, recipientUserIds) {
  const { data, error } = await client
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', recipientUserIds);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function cleanupSubscriptions(client, invalidEndpoints) {
  if (!invalidEndpoints.length) {
    return;
  }

  const { error } = await client
    .from('push_subscriptions')
    .delete()
    .in('endpoint', invalidEndpoints);

  if (error) {
    console.error('Impossible de nettoyer les subscriptions invalides :', error);
  }
}

async function handleTagPush(client, user, body, res) {
  const photoId = typeof body.photoId === 'string' ? body.photoId.trim() : '';
  const recipientUserIds = Array.isArray(body.recipientUserIds)
    ? [...new Set(body.recipientUserIds.filter(id => typeof id === 'string' && id.trim()).map(id => id.trim()))]
    : [];

  if (!photoId || recipientUserIds.length === 0) {
    res.status(400).json({ error: { message: 'photoId ou recipientUserIds manquant.' } });
    return;
  }

  const actorProfile = await getProfileById(client, user.id);

  const { data: photo, error: photoError } = await client
    .from('photos')
    .select('id, album_id, uploaded_by')
    .eq('id', photoId)
    .single();

  if (photoError || !photo) {
    res.status(404).json({ error: { message: 'Photo introuvable.' } });
    return;
  }

  const isAdmin = actorProfile.role === 'admin';
  if (photo.uploaded_by !== user.id && !isAdmin) {
    res.status(403).json({ error: { message: 'Action non autorisée.' } });
    return;
  }

  const subscriptions = await fetchSubscriptions(client, recipientUserIds);
  if (subscriptions.length === 0) {
    res.status(200).json({ delivered: 0 });
    return;
  }

  const payload = buildNotificationPayload({
    title: 'Vous avez été identifié / Foi marcado',
    body: `${actorProfile.display_name} vous a identifié sur une photo.`,
    url: `/album/${photo.album_id}?photo=${photoId}`,
    tag: `photo-tag-${photoId}`
  });

  const { deliveredCount, invalidEndpoints } = await sendPushToSubscriptions(subscriptions, payload);
  await cleanupSubscriptions(client, invalidEndpoints);

  res.status(200).json({ delivered: deliveredCount });
}

async function resolveAnnouncementRecipients(client, recipientUserIds) {
  if (recipientUserIds.length > 0) {
    const { data, error } = await client
      .from('profiles')
      .select('id')
      .eq('role', 'guest')
      .in('id', recipientUserIds);

    if (error) {
      throw error;
    }

    return (data ?? []).map(profile => profile.id);
  }

  const { data, error } = await client
    .from('profiles')
    .select('id')
    .eq('role', 'guest');

  if (error) {
    throw error;
  }

  return (data ?? []).map(profile => profile.id);
}

async function handleAdminAnnouncement(client, user, body, res) {
  const actorProfile = await getProfileById(client, user.id);
  if (actorProfile.role !== 'admin') {
    res.status(403).json({ error: { message: 'Accès administrateur requis.' } });
    return;
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const recipientUserIds = Array.isArray(body.recipientUserIds)
    ? [...new Set(body.recipientUserIds.filter(id => typeof id === 'string' && id.trim()).map(id => id.trim()))]
    : [];

  if (!title || !message) {
    res.status(400).json({ error: { message: 'Titre ou message manquant.' } });
    return;
  }

  const recipients = await resolveAnnouncementRecipients(client, recipientUserIds);
  if (recipients.length === 0) {
    res.status(200).json({ delivered: 0, created: 0 });
    return;
  }

  const rows = recipients.map(recipientUserId => ({
    recipient_user_id: recipientUserId,
    actor_user_id: user.id,
    photo_id: null,
    album_id: null,
    type: 'admin_announcement',
    title,
    message,
    is_read: false
  }));

  const { error: insertError } = await client
    .from('notifications')
    .insert(rows);

  if (insertError) {
    throw insertError;
  }

  const subscriptions = await fetchSubscriptions(client, recipients);
  if (subscriptions.length === 0) {
    res.status(200).json({ delivered: 0, created: recipients.length });
    return;
  }

  const payload = buildNotificationPayload({
    title,
    body: message,
    url: '/profile',
    tag: `admin-announcement-${Date.now()}`
  });

  const { deliveredCount, invalidEndpoints } = await sendPushToSubscriptions(subscriptions, payload);
  await cleanupSubscriptions(client, invalidEndpoints);

  res.status(200).json({
    delivered: deliveredCount,
    created: recipients.length
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: { message: 'Méthode non autorisée.' } });
    return;
  }

  try {
    configureWebPush();
    const client = getServiceSupabase();
    const user = await getAuthenticatedUser(req, client);

    if (!user) {
      res.status(401).json({ error: { message: 'Authentification requise.' } });
      return;
    }

    const body = parseBody(req);
    const type = typeof body.type === 'string' ? body.type.trim() : '';

    if (type === 'photo_tag_push') {
      await handleTagPush(client, user, body, res);
      return;
    }

    if (type === 'admin_announcement') {
      await handleAdminAnnouncement(client, user, body, res);
      return;
    }

    res.status(400).json({ error: { message: 'Type de notification inconnu.' } });
  } catch (error) {
    console.error('Erreur notifications API :', error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Erreur serveur notifications.'
      }
    });
  }
};
