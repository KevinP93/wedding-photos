import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LoginComponent } from './login.component';
import { AlbumService } from '../../services/album.service';
import { SupabaseService } from '../../services/supabase.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  const albumServiceSpy = jasmine.createSpyObj('AlbumService', ['refreshSharedAlbums']);
  const supabaseServiceSpy = jasmine.createSpyObj('SupabaseService', [
    'getCurrentAppUser',
    'signUpWithUsername',
    'signInWithUsername',
    'normalizeUsername'
  ]);

  beforeEach(async () => {
    sessionStorage.clear();
    albumServiceSpy.refreshSharedAlbums.and.resolveTo();
    supabaseServiceSpy.getCurrentAppUser.and.resolveTo(null);
    supabaseServiceSpy.signUpWithUsername.and.resolveTo({
      id: 'user-1',
      username: 'camille',
      displayName: 'Camille',
      role: 'guest',
      albumId: 'album-1',
      avatarUrl: ''
    });
    supabaseServiceSpy.signInWithUsername.and.resolveTo({
      id: 'user-1',
      username: 'camille',
      displayName: 'Camille',
      role: 'guest',
      albumId: 'album-1',
      avatarUrl: ''
    });
    supabaseServiceSpy.normalizeUsername.and.callFake((value: string) => value.toLowerCase().trim());

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
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

    fixture = TestBed.createComponent(LoginComponent);
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
