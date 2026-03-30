import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { GalleryComponent } from './gallery.component';
import { Album, AlbumService } from '../../services/album.service';
import { CloudinaryService } from '../../services/cloudinary.service';
import { SupabaseService } from '../../services/supabase.service';

describe('GalleryComponent', () => {
  let component: GalleryComponent;
  let fixture: ComponentFixture<GalleryComponent>;
  const albums$ = new BehaviorSubject<Album[]>([]);
  const albumServiceSpy = jasmine.createSpyObj('AlbumService', ['ready', 'deleteAlbum']);
  const cloudinaryServiceSpy = jasmine.createSpyObj('CloudinaryService', ['deleteImage']);
  const supabaseServiceSpy = jasmine.createSpyObj('SupabaseService', ['signOut', 'normalizeUsername', 'updateCurrentProfile']);

  beforeEach(async () => {
    sessionStorage.setItem('currentUserId', 'user-1');
    sessionStorage.setItem('currentGuest', 'Camille');
    sessionStorage.setItem('currentUsername', 'camille');
    sessionStorage.setItem('currentAlbumId', 'camille');
    sessionStorage.setItem('currentAvatarUrl', '');
    albumServiceSpy.ready.and.resolveTo();
    albumServiceSpy.deleteAlbum.and.resolveTo();
    cloudinaryServiceSpy.deleteImage.and.resolveTo({ result: 'ok' });
    supabaseServiceSpy.signOut.and.resolveTo();
    supabaseServiceSpy.normalizeUsername.and.callFake((value: string) => value.toLowerCase().trim());
    supabaseServiceSpy.updateCurrentProfile.and.resolveTo({
      id: 'user-1',
      username: 'camille',
      displayName: 'Camille',
      role: 'guest',
      albumId: 'camille',
      avatarUrl: ''
    });

    await TestBed.configureTestingModule({
      imports: [GalleryComponent],
      providers: [
        provideRouter([]),
        {
          provide: AlbumService,
          useValue: {
            albums$: albums$.asObservable(),
            ready: albumServiceSpy.ready,
            deleteAlbum: albumServiceSpy.deleteAlbum,
            refreshSharedAlbums: jasmine.createSpy('refreshSharedAlbums').and.resolveTo()
          }
        },
        {
          provide: CloudinaryService,
          useValue: cloudinaryServiceSpy
        },
        {
          provide: SupabaseService,
          useValue: supabaseServiceSpy
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GalleryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    sessionStorage.clear();
    albums$.next([]);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
