import { TestBed } from '@angular/core/testing';
import { AlbumService } from './album.service';
import { SupabaseService } from './supabase.service';

describe('AlbumService', () => {
  let service: AlbumService;
  let supabaseServiceSpy: jasmine.SpyObj<SupabaseService>;
  const albumRow = {
    id: 'album-1',
    title: 'Album de Camille Dupont',
    created_at: '2026-03-30T10:00:00.000Z',
    owner_id: 'user-1',
    owner: {
      id: 'user-1',
      username: 'camille-dupont',
      display_name: 'Camille Dupont',
      role: 'guest',
      avatar_url: ''
    },
    photos: []
  };

  beforeEach(() => {
    sessionStorage.clear();
    supabaseServiceSpy = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['fetchAlbums']);
    supabaseServiceSpy.fetchAlbums.and.resolveTo([albumRow]);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SupabaseService,
          useValue: supabaseServiceSpy
        }
      ]
    });
    service = TestBed.inject(AlbumService);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should load shared albums from supabase', async () => {
    await service.ready(true);

    const album = service.getAlbum('album-1');

    expect(album?.ownerUsername).toBe('camille-dupont');
    expect(service.getAllAlbums().length).toBe(1);
    expect(supabaseServiceSpy.fetchAlbums).toHaveBeenCalled();
  });
});
