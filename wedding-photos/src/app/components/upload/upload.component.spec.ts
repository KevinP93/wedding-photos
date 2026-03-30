import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UploadComponent } from './upload.component';
import { AlbumService } from '../../services/album.service';
import { CloudinaryService } from '../../services/cloudinary.service';
import { SupabaseService } from '../../services/supabase.service';

describe('UploadComponent', () => {
  let component: UploadComponent;
  let fixture: ComponentFixture<UploadComponent>;
  const cloudinaryServiceSpy = jasmine.createSpyObj('CloudinaryService', ['uploadFile']);
  const albumServiceSpy = jasmine.createSpyObj('AlbumService', ['ready', 'getCurrentUserAlbum', 'addPhotoToAlbum']);
  const supabaseServiceSpy = jasmine.createSpyObj('SupabaseService', ['signOut']);

  beforeEach(async () => {
    sessionStorage.setItem('currentUserId', 'user-1');
    sessionStorage.setItem('currentGuest', 'Camille');
    sessionStorage.setItem('currentUsername', 'camille');
    sessionStorage.setItem('currentAlbumId', 'camille');
    sessionStorage.setItem('currentAvatarUrl', '');
    albumServiceSpy.ready.and.resolveTo();
    albumServiceSpy.getCurrentUserAlbum.and.resolveTo({
      id: 'camille',
      name: 'Camille',
      ownerUsername: 'camille',
      avatarUrl: '',
      photos: [],
      createdAt: new Date().toISOString()
    });
    albumServiceSpy.addPhotoToAlbum.and.resolveTo();
    supabaseServiceSpy.signOut.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [UploadComponent],
      providers: [
        provideRouter([]),
        {
          provide: CloudinaryService,
          useValue: cloudinaryServiceSpy
        },
        {
          provide: AlbumService,
          useValue: albumServiceSpy
        },
        {
          provide: SupabaseService,
          useValue: supabaseServiceSpy
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
