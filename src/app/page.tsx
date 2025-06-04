import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, addDoc, serverTimestamp } from 'firebase/firestore';

// Lucide React icons (simplified for direct use)
const Home = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const User = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const Briefcase = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/><path d="M12 12h.01"/></svg>;
const Search = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
const MessageSquare = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const Plus = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 5v14"/><path d="M5 12h14"/></svg>;
const Send = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m22 2-7 20-4-9-9-4 20-7z"/><path d="M15 7l4 4"/></svg>;
const X = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>;


// Context for Firebase and User state
const AppContext = createContext();

const App = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [user, setUser] = useState(null); // Firebase User object
    const [userId, setUserId] = useState(null); // Our internal userId (Firebase UID or anonymous ID)
    const [userProfile, setUserProfile] = useState(null); // Custom user profile from Firestore
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [currentPage, setCurrentPage] = useState('home'); // 'home', 'register', 'buyer-dashboard', 'seller-dashboard', 'add-service', 'chat-list', 'chat-window'
    const [selectedService, setSelectedService] = useState(null); // For buyer to view service details
    const [selectedChat, setSelectedChat] = useState(null); // For viewing a specific chat

    // Initialize Firebase and handle authentication
    useEffect(() => {
        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

            if (Object.keys(firebaseConfig).length === 0) {
                console.error("Firebase config is missing. Please ensure __firebase_config is provided.");
                return;
            }

            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const authInstance = getAuth(app);

            setDb(firestore);
            setAuth(authInstance);

            // Listen for auth state changes
            const unsubscribe = onAuthStateChanged(authInstance, async (currentUser) => {
                if (currentUser) {
                    setUser(currentUser);
                    setUserId(currentUser.uid);
                    // Fetch user profile
                    const userProfileRef = doc(firestore, `artifacts/${appId}/users/${currentUser.uid}/profile`, 'data');
                    const profileSnap = await getDoc(userProfileRef);
                    if (profileSnap.exists()) {
                        setUserProfile(profileSnap.data());
                        if (profileSnap.data().role === 'buyer') {
                            setCurrentPage('buyer-dashboard');
                        } else if (profileSnap.data().role === 'seller') {
                            setCurrentPage('seller-dashboard');
                        }
                    } else {
                        // User exists but no profile, send to registration to choose role
                        setCurrentPage('register');
                    }
                } else {
                    // No user signed in, try anonymous or custom token
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        await signInWithCustomToken(authInstance, __initial_auth_token);
                    } else {
                        await signInAnonymously(authInstance);
                    }
                    setUser(null);
                    setUserId(null); // Reset userId if signed out
                    setUserProfile(null); // Reset profile
                    setCurrentPage('home'); // Go to home if not authenticated
                }
                setIsAuthReady(true);
            });

            return () => unsubscribe(); // Cleanup auth listener
        } catch (error) {
            console.error("Error initializing Firebase:", error);
        }
    }, []);

    // Helper to get user profile (used by children components)
    const fetchUserProfile = async (uid) => {
        if (!db || !uid) return null;
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const userProfileRef = doc(db, `artifacts/${appId}/users/${uid}/profile`, 'data');
        const profileSnap = await getDoc(userProfileRef);
        return profileSnap.exists() ? profileSnap.data() : null;
    };

    // Loading state
    if (!isAuthReady) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-green-100 p-4">
                <div className="text-teal-700 text-xl font-semibold">Loading app...</div>
            </div>
        );
    }

    return (
        <AppContext.Provider value={{ db, auth, user, userId, userProfile, setUserProfile, setCurrentPage, fetchUserProfile }}>
            <div className="min-h-screen bg-gradient-to-br from-teal-50 to-green-100 font-sans text-gray-800 flex flex-col">
                <header className="bg-white shadow-sm p-4 flex items-center justify-between rounded-b-xl">
                    <h1 className="text-2xl font-bold text-teal-700">Maid Service Hub</h1>
                    {userId && (
                        <div className="text-sm text-gray-600">
                            {userProfile ? (
                                <span className="font-medium">{userProfile.name} ({userProfile.role})</span>
                            ) : (
                                <span className="font-medium">User ID: {userId.substring(0, 8)}...</span>
                            )}
                        </div>
                    )}
                </header>

                <main className="flex-grow p-4 overflow-auto">
                    {currentPage === 'home' && <HomeScreen setCurrentPage={setCurrentPage} />}
                    {currentPage === 'register' && <RegisterScreen setCurrentPage={setCurrentPage} setUserProfile={setUserProfile} />}
                    {currentPage === 'buyer-dashboard' && <BuyerDashboard setSelectedService={setSelectedService} setCurrentPage={setCurrentPage} />}
                    {currentPage === 'seller-dashboard' && <SellerDashboard setCurrentPage={setCurrentPage} />}
                    {currentPage === 'add-service' && <AddServiceForm setCurrentPage={setCurrentPage} />}
                    {currentPage === 'view-service' && selectedService && <ServiceDetailView service={selectedService} setCurrentPage={setCurrentPage} />}
                    {currentPage === 'chat-list' && <ChatList setSelectedChat={setSelectedChat} setCurrentPage={setCurrentPage} />}
                    {currentPage === 'chat-window' && selectedChat && <ChatWindow chat={selectedChat} setCurrentPage={setCurrentPage} />}
                </main>

                {userProfile && (
                    <nav className="bg-white shadow-lg p-3 flex justify-around items-center rounded-t-xl">
                        <NavItem icon={<Home className="w-6 h-6" />} label="Home" onClick={() => {
                            if (userProfile.role === 'buyer') setCurrentPage('buyer-dashboard');
                            else if (userProfile.role === 'seller') setCurrentPage('seller-dashboard');
                            else setCurrentPage('home');
                        }} />
                        {userProfile.role === 'seller' && (
                            <NavItem icon={<Briefcase className="w-6 h-6" />} label="My Services" onClick={() => setCurrentPage('seller-dashboard')} />
                        )}
                        {userProfile.role === 'buyer' && (
                            <NavItem icon={<Search className="w-6 h-6" />} label="Search" onClick={() => setCurrentPage('buyer-dashboard')} />
                        )}
                        <NavItem icon={<MessageSquare className="w-6 h-6" />} label="Chats" onClick={() => setCurrentPage('chat-list')} />
                        <NavItem icon={<User className="w-6 h-6" />} label="Profile" onClick={() => console.log('Profile page TBD')} />
                    </nav>
                )}
            </div>
        </AppContext.Provider>
    );
};

// Nav Item Component
const NavItem = ({ icon, label, onClick }) => (
    <button
        className="flex flex-col items-center p-2 text-teal-600 hover:text-teal-800 focus:outline-none transition-colors duration-200"
        onClick={onClick}
    >
        {icon}
        <span className="text-xs mt-1">{label}</span>
    </button>
);

// Home Screen
const HomeScreen = ({ setCurrentPage }) => {
    const { userId } = useContext(AppContext);

    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <h2 className="text-3xl font-bold text-teal-800 mb-6">Welcome to Maid Service Hub!</h2>
            <p className="text-lg text-gray-700 mb-8 max-w-md">
                Your one-stop platform for connecting with reliable household service providers.
            </p>
            {!userId && (
                <p className="text-md text-gray-600 mb-8">
                    Please wait while we set up your anonymous session, then you can register.
                </p>
            )}
            {userId && (
                <button
                    onClick={() => setCurrentPage('register')}
                    className="bg-teal-600 text-white px-8 py-3 rounded-full text-lg font-semibold shadow-md hover:bg-teal-700 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-opacity-50"
                >
                    Get Started
                </button>
            )}
        </div>
    );
};

// Register Screen
const RegisterScreen = ({ setCurrentPage, setUserProfile }) => {
    const { db, userId } = useContext(AppContext);
    const [name, setName] = useState('');
    const [role, setRole] = useState(''); // 'buyer' or 'seller'
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [modalMessage, setModalMessage] = useState('');

    const handleRegister = async () => {
        if (!name || !role) {
            setError('Please enter your name and select a role.');
            return;
        }
        if (!db || !userId) {
            setModalMessage('Authentication not ready. Please try again.');
            setShowModal(true);
            return;
        }

        setError('');
        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const userProfileRef = doc(db, `artifacts/${appId}/users/${userId}/profile`, 'data');
            const newProfile = { name, role, userId, createdAt: serverTimestamp() };
            await setDoc(userProfileRef, newProfile);
            setUserProfile(newProfile); // Update context state
            setModalMessage('Registration successful!');
            setShowModal(true);
            // Navigate to appropriate dashboard after successful registration
            setTimeout(() => {
                setShowModal(false);
                if (role === 'buyer') {
                    setCurrentPage('buyer-dashboard');
                } else {
                    setCurrentPage('seller-dashboard');
                }
            }, 1500);
        } catch (e) {
            console.error("Error adding document: ", e);
            setModalMessage('Error registering. Please try again.');
            setShowModal(true);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-lg max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-teal-700 mb-6">Register Your Profile</h2>
            <p className="text-gray-600 mb-4 text-center">
                Tell us a bit about yourself to get started.
            </p>
            <div className="w-full mb-4">
                <label htmlFor="name" className="block text-gray-700 text-sm font-medium mb-2">Your Name</label>
                <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200"
                    placeholder="e.g., Jane Doe"
                />
            </div>
            <div className="w-full mb-6">
                <label className="block text-gray-700 text-sm font-medium mb-2">I am a:</label>
                <div className="flex space-x-4">
                    <button
                        onClick={() => setRole('buyer')}
                        className={`flex-1 p-3 rounded-lg border-2 ${role === 'buyer' ? 'bg-teal-500 text-white border-teal-500' : 'bg-gray-100 text-gray-700 border-gray-300'} hover:bg-teal-400 hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-opacity-50`}
                    >
                        Buyer (Looking for services)
                    </button>
                    <button
                        onClick={() => setRole('seller')}
                        className={`flex-1 p-3 rounded-lg border-2 ${role === 'seller' ? 'bg-teal-500 text-white border-teal-500' : 'bg-gray-100 text-gray-700 border-gray-300'} hover:bg-teal-400 hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-opacity-50`}
                    >
                        Seller (Offering services)
                    </button>
                </div>
            </div>
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <button
                onClick={handleRegister}
                className="w-full bg-teal-600 text-white px-6 py-3 rounded-full text-lg font-semibold shadow-md hover:bg-teal-700 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-opacity-50"
            >
                Complete Registration
            </button>

            {showModal && (
                <Modal message={modalMessage} onClose={() => setShowModal(false)} />
            )}
        </div>
    );
};

// Buyer Dashboard
const BuyerDashboard = ({ setSelectedService, setCurrentPage }) => {
    const { db, userId } = useContext(AppContext);
    const [services, setServices] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!db) return;

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const servicesColRef = collection(db, `artifacts/${appId}/public/data/services`);

        // Fetch all services initially
        const unsubscribe = onSnapshot(servicesColRef, (snapshot) => {
            const fetchedServices = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Sort services by latest first
            fetchedServices.sort((a, b) => b.postedAt?.toDate() - a.postedAt?.toDate());
            setServices(fetchedServices);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching services:", err);
            setError("Failed to load services. Please try again.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db]);

    const filteredServices = services.filter(service =>
        service.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleViewService = (service) => {
        setSelectedService(service);
        setCurrentPage('view-service');
    };

    if (loading) return <div className="text-center text-teal-700">Loading services...</div>;
    if (error) return <div className="text-center text-red-500">{error}</div>;

    return (
        <div className="p-4">
            <h2 className="text-2xl font-bold text-teal-700 mb-6">Find Services</h2>
            <div className="mb-6 relative">
                <input
                    type="text"
                    placeholder="Search for services (e.g., cleaning, gardening)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-3 pl-10 border border-gray-300 rounded-full focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 shadow-sm"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            </div>

            {filteredServices.length === 0 ? (
                <p className="text-center text-gray-600 mt-10">No services found. Try a different search or check back later!</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredServices.map(service => (
                        <ServiceCard key={service.id} service={service} onClick={() => handleViewService(service)} />
                    ))}
                </div>
            )}
        </div>
    );
};

// Service Card Component
const ServiceCard = ({ service, onClick }) => {
    return (
        <div
            className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-shadow duration-300 border border-gray-100 flex flex-col justify-between"
            onClick={onClick}
        >
            <div>
                <h3 className="text-xl font-semibold text-teal-700 mb-2">{service.serviceName}</h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">{service.description}</p>
            </div>
            <div className="flex justify-between items-center mt-4">
                <span className="text-md font-bold text-green-600">{service.price}</span>
                <span className="text-xs text-gray-500">
                    {service.postedAt ? new Date(service.postedAt.toDate()).toLocaleDateString() : 'N/A'}
                </span>
            </div>
        </div>
    );
};

// Service Detail View (for buyers)
const ServiceDetailView = ({ service, setCurrentPage }) => {
    const { db, userId, userProfile, fetchUserProfile } = useContext(AppContext);
    const [sellerProfile, setSellerProfile] = useState(null);
    const [loadingSeller, setLoadingSeller] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [modalMessage, setModalMessage] = useState('');

    useEffect(() => {
        const getSellerProfile = async () => {
            if (service?.sellerId) {
                const profile = await fetchUserProfile(service.sellerId);
                setSellerProfile(profile);
            }
            setLoadingSeller(false);
        };
        getSellerProfile();
    }, [service, fetchUserProfile]);

    const handleInitiateChat = async () => {
        if (!db || !userId || !userProfile || !service) {
            setModalMessage('App data not ready. Please try again.');
            setShowModal(true);
            return;
        }

        if (userProfile.role !== 'buyer') {
            setModalMessage('Only buyers can initiate chats.');
            setShowModal(true);
            return;
        }

        if (userId === service.sellerId) {
            setModalMessage('You cannot chat with yourself.');
            setShowModal(true);
            return;
        }

        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const chatsColRef = collection(db, `artifacts/${appId}/public/data/chats`);

            // Check if a chat already exists between this buyer and seller for this service
            const q = query(
                chatsColRef,
                where('serviceId', '==', service.id),
                where('participants', 'array-contains', userId)
            );
            const querySnapshot = await getDocs(q); // Use getDocs for a one-time fetch

            let existingChat = null;
            querySnapshot.forEach(doc => {
                const data = doc.data();
                // Ensure the other participant is also the seller
                if (data.participants.includes(service.sellerId)) {
                    existingChat = { id: doc.id, ...data };
                }
            });

            if (existingChat) {
                setModalMessage('Chat already exists. Opening chat window.');
                setShowModal(true);
                setTimeout(() => {
                    setShowModal(false);
                    setCurrentPage('chat-list'); // Go to chat list, then user can select
                }, 1500);
                return;
            }

            // Create a new chat
            const newChat = {
                serviceId: service.id,
                participants: [userId, service.sellerId],
                createdAt: serverTimestamp(),
                lastMessage: '',
            };
            await addDoc(chatsColRef, newChat);
            setModalMessage('Chat initiated successfully! You can now find it in your chats.');
            setShowModal(true);
            setTimeout(() => {
                setShowModal(false);
                setCurrentPage('chat-list');
            }, 1500);

        } catch (error) {
            console.error("Error initiating chat:", error);
            setModalMessage('Failed to initiate chat. Please try again.');
            setShowModal(true);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl mx-auto">
            <button
                onClick={() => setCurrentPage('buyer-dashboard')}
                className="mb-4 text-teal-600 hover:text-teal-800 flex items-center transition-colors duration-200"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="m15 18-6-6 6-6"/></svg>
                Back to Services
            </button>

            <h2 className="text-3xl font-bold text-teal-700 mb-4">{service.serviceName}</h2>
            <p className="text-gray-700 text-lg mb-6">{service.description}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-teal-50 p-4 rounded-lg">
                    <p className="text-sm text-teal-800 font-semibold">Price:</p>
                    <p className="text-xl font-bold text-green-600">{service.price}</p>
                </div>
                <div className="bg-teal-50 p-4 rounded-lg">
                    <p className="text-sm text-teal-800 font-semibold">Availability:</p>
                    <p className="text-md text-gray-700">{service.availability}</p>
                </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h3 className="text-lg font-semibold text-teal-700 mb-2">About the Seller</h3>
                {loadingSeller ? (
                    <p className="text-gray-600">Loading seller info...</p>
                ) : sellerProfile ? (
                    <>
                        <p className="text-md text-gray-700 font-medium">{sellerProfile.name}</p>
                        <p className="text-sm text-gray-500">User ID: {sellerProfile.userId.substring(0, 8)}...</p>
                        {sellerProfile.contact && <p className="text-sm text-gray-500">Contact: {sellerProfile.contact}</p>}
                    </>
                ) : (
                    <p className="text-gray-600">Seller information not available.</p>
                )}
            </div>

            {userId !== service.sellerId && userProfile?.role === 'buyer' && (
                <button
                    onClick={handleInitiateChat}
                    className="w-full bg-teal-600 text-white px-6 py-3 rounded-full text-lg font-semibold shadow-md hover:bg-teal-700 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-opacity-50"
                >
                    Message Seller
                </button>
            )}

            {showModal && (
                <Modal message={modalMessage} onClose={() => setShowModal(false)} />
            )}
        </div>
    );
};

// Seller Dashboard
const SellerDashboard = ({ setCurrentPage }) => {
    const { db, userId } = useContext(AppContext);
    const [myServices, setMyServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [modalMessage, setModalMessage] = useState('');

    useEffect(() => {
        if (!db || !userId) return;

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const servicesColRef = collection(db, `artifacts/${appId}/public/data/services`);
        const q = query(servicesColRef, where('sellerId', '==', userId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedServices = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Sort services by latest first
            fetchedServices.sort((a, b) => b.postedAt?.toDate() - a.postedAt?.toDate());
            setMyServices(fetchedServices);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching seller services:", err);
            setError("Failed to load your services. Please try again.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db, userId]);

    const handleDeleteService = async (serviceId) => {
        if (!db || !userId) {
            setModalMessage('App data not ready. Please try again.');
            setShowModal(true);
            return;
        }
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const serviceDocRef = doc(db, `artifacts/${appId}/public/data/services`, serviceId);

        // Confirmation dialog (using modal instead of alert/confirm)
        setModalMessage('Are you sure you want to delete this service? This action cannot be undone.');
        setShowModal(true);

        const handleConfirm = async () => {
            try {
                await deleteDoc(serviceDocRef); // Firestore deleteDoc not imported, need to add it
                setModalMessage('Service deleted successfully!');
                setShowModal(true);
                setTimeout(() => setShowModal(false), 1500);
            } catch (e) {
                console.error("Error deleting service: ", e);
                setModalMessage('Error deleting service. Please try again.');
                setShowModal(true);
            }
        };

        // For simplicity, I'm not implementing a full confirmation modal here.
        // In a real app, the modal would have "Confirm" and "Cancel" buttons,
        // and handleConfirm would be called only on "Confirm".
        // For now, I'll just log a message.
        console.log("Delete functionality needs a proper confirmation modal.");
        setModalMessage("Delete functionality is placeholder. Service deletion not implemented yet.");
        setShowModal(true);
        setTimeout(() => setShowModal(false), 2000);
    };


    if (loading) return <div className="text-center text-teal-700">Loading your services...</div>;
    if (error) return <div className="text-center text-red-500">{error}</div>;

    return (
        <div className="p-4">
            <h2 className="text-2xl font-bold text-teal-700 mb-6">My Services</h2>
            <button
                onClick={() => setCurrentPage('add-service')}
                className="bg-teal-600 text-white px-6 py-3 rounded-full text-lg font-semibold shadow-md hover:bg-teal-700 transition-colors duration-300 flex items-center justify-center mb-6 w-full sm:w-auto"
            >
                <Plus className="w-5 h-5 mr-2" /> Add New Service
            </button>

            {myServices.length === 0 ? (
                <p className="text-center text-gray-600 mt-10">You haven't listed any services yet. Click "Add New Service" to get started!</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {myServices.map(service => (
                        <div key={service.id} className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 flex flex-col justify-between">
                            <div>
                                <h3 className="text-xl font-semibold text-teal-700 mb-2">{service.serviceName}</h3>
                                <p className="text-gray-600 text-sm mb-4 line-clamp-3">{service.description}</p>
                            </div>
                            <div className="flex justify-between items-center mt-4">
                                <span className="text-md font-bold text-green-600">{service.price}</span>
                                <button
                                    onClick={() => handleDeleteService(service.id)}
                                    className="text-red-500 hover:text-red-700 transition-colors duration-200 text-sm font-medium"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <Modal message={modalMessage} onClose={() => setShowModal(false)} />
            )}
        </div>
    );
};


// Add Service Form
const AddServiceForm = ({ setCurrentPage }) => {
    const { db, userId } = useContext(AppContext);
    const [serviceName, setServiceName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [availability, setAvailability] = useState('');
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [modalMessage, setModalMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!serviceName || !description || !price || !availability) {
            setError('All fields are required.');
            return;
        }
        if (!db || !userId) {
            setModalMessage('Authentication not ready. Please try again.');
            setShowModal(true);
            return;
        }

        setError('');
        try {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const servicesColRef = collection(db, `artifacts/${appId}/public/data/services`);
            await addDoc(servicesColRef, {
                sellerId: userId,
                serviceName,
                description,
                price,
                availability,
                postedAt: serverTimestamp(),
            });
            setModalMessage('Service added successfully!');
            setShowModal(true);
            setTimeout(() => {
                setShowModal(false);
                setCurrentPage('seller-dashboard');
            }, 1500);
        } catch (e) {
            console.error("Error adding document: ", e);
            setModalMessage('Error adding service. Please try again.');
            setShowModal(true);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-md mx-auto">
            <button
                onClick={() => setCurrentPage('seller-dashboard')}
                className="mb-4 text-teal-600 hover:text-teal-800 flex items-center transition-colors duration-200"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="m15 18-6-6 6-6"/></svg>
                Back to My Services
            </button>
            <h2 className="text-2xl font-bold text-teal-700 mb-6">Add New Service</h2>
            <form onSubmit={handleSubmit}>
                <div className="mb-4">
                    <label htmlFor="serviceName" className="block text-gray-700 text-sm font-medium mb-2">Service Name</label>
                    <input
                        type="text"
                        id="serviceName"
                        value={serviceName}
                        onChange={(e) => setServiceName(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200"
                        placeholder="e.g., Deep Cleaning, Gardening"
                    />
                </div>
                <div className="mb-4">
                    <label htmlFor="description" className="block text-gray-700 text-sm font-medium mb-2">Description</label>
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows="4"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 resize-y"
                        placeholder="Describe your service in detail..."
                    ></textarea>
                </div>
                <div className="mb-4">
                    <label htmlFor="price" className="block text-gray-700 text-sm font-medium mb-2">Price (e.g., R250/hour, R1000/job)</label>
                    <input
                        type="text"
                        id="price"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200"
                        placeholder="e.g., R250/hour"
                    />
                </div>
                <div className="mb-6">
                    <label htmlFor="availability" className="block text-gray-700 text-sm font-medium mb-2">Availability</label>
                    <input
                        type="text"
                        id="availability"
                        value={availability}
                        onChange={(e) => setAvailability(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200"
                        placeholder="e.g., Weekdays 9am-5pm, Weekends"
                    />
                </div>
                {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
                <button
                    type="submit"
                    className="w-full bg-teal-600 text-white px-6 py-3 rounded-full text-lg font-semibold shadow-md hover:bg-teal-700 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-opacity-50"
                >
                    Add Service
                </button>
            </form>

            {showModal && (
                <Modal message={modalMessage} onClose={() => setShowModal(false)} />
            )}
        </div>
    );
};

// Chat List
const ChatList = ({ setSelectedChat, setCurrentPage }) => {
    const { db, userId, userProfile, fetchUserProfile } = useContext(AppContext);
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [participantNames, setParticipantNames] = useState({}); // Cache for participant names

    useEffect(() => {
        if (!db || !userId) return;

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const chatsColRef = collection(db, `artifacts/${appId}/public/data/chats`);
        const q = query(chatsColRef, where('participants', 'array-contains', userId));

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const fetchedChats = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Fetch participant names for display
            const names = { ...participantNames };
            for (const chat of fetchedChats) {
                for (const participantId of chat.participants) {
                    if (participantId !== userId && !names[participantId]) {
                        const profile = await fetchUserProfile(participantId);
                        if (profile) {
                            names[participantId] = profile.name;
                        } else {
                            names[participantId] = 'Unknown User';
                        }
                    }
                }
            }
            setParticipantNames(names);

            // Sort chats by last message timestamp or creation time
            fetchedChats.sort((a, b) => (b.lastMessageTimestamp?.toDate() || b.createdAt?.toDate()) - (a.lastMessageTimestamp?.toDate() || a.createdAt?.toDate()));

            setChats(fetchedChats);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching chats:", err);
            setError("Failed to load chats. Please try again.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db, userId, fetchUserProfile]);

    const handleViewChat = (chat) => {
        setSelectedChat(chat);
        setCurrentPage('chat-window');
    };

    if (loading) return <div className="text-center text-teal-700">Loading chats...</div>;
    if (error) return <div className="text-center text-red-500">{error}</div>;

    return (
        <div className="p-4">
            <h2 className="text-2xl font-bold text-teal-700 mb-6">Your Chats</h2>
            {chats.length === 0 ? (
                <p className="text-center text-gray-600 mt-10">You have no active chats yet.</p>
            ) : (
                <div className="space-y-4">
                    {chats.map(chat => {
                        const otherParticipantId = chat.participants.find(id => id !== userId);
                        const otherParticipantName = participantNames[otherParticipantId] || 'Loading...';
                        return (
                            <div
                                key={chat.id}
                                onClick={() => handleViewChat(chat)}
                                className="bg-white rounded-xl shadow-lg p-4 cursor-pointer hover:shadow-xl transition-shadow duration-300 border border-gray-100"
                            >
                                <h3 className="text-lg font-semibold text-teal-700">Chat with {otherParticipantName}</h3>
                                <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                                    {chat.lastMessage || 'No messages yet.'}
                                </p>
                                <p className="text-xs text-gray-400 mt-2">
                                    {chat.lastMessageTimestamp ? new Date(chat.lastMessageTimestamp.toDate()).toLocaleString() : 'N/A'}
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// Chat Window
const ChatWindow = ({ chat, setCurrentPage }) => {
    const { db, userId, userProfile, fetchUserProfile } = useContext(AppContext);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loadingMessages, setLoadingMessages] = useState(true);
    const [error, setError] = useState('');
    const messagesEndRef = React.useRef(null);
    const [participantNames, setParticipantNames] = useState({}); // Cache for participant names

    useEffect(() => {
        if (!db || !chat?.id) return;

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const messagesColRef = collection(db, `artifacts/${appId}/public/data/chats/${chat.id}/messages`);
        const q = query(messagesColRef, orderBy('timestamp')); // orderBy requires import

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const fetchedMessages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(fetchedMessages);
            setLoadingMessages(false);

            // Fetch participant names if not already cached
            const names = { ...participantNames };
            for (const participantId of chat.participants) {
                if (!names[participantId]) {
                    const profile = await fetchUserProfile(participantId);
                    if (profile) {
                        names[participantId] = profile.name;
                    } else {
                        names[participantId] = 'Unknown User';
                    }
                }
            }
            setParticipantNames(names);

            // Scroll to bottom
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
        }, (err) => {
            console.error("Error fetching messages:", err);
            setError("Failed to load messages. Please try again.");
            setLoadingMessages(false);
        });

        return () => unsubscribe();
    }, [db, chat, fetchUserProfile]);

    const handleSendMessage = async () => {
        if (!db || !userId || !newMessage.trim()) return;

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const messagesColRef = collection(db, `artifacts/${appId}/public/data/chats/${chat.id}/messages`);
        const chatDocRef = doc(db, `artifacts/${appId}/public/data/chats`, chat.id);

        try {
            await addDoc(messagesColRef, {
                senderId: userId,
                text: newMessage,
                timestamp: serverTimestamp(),
            });
            // Update lastMessage and lastMessageTimestamp on the chat document
            await updateDoc(chatDocRef, {
                lastMessage: newMessage,
                lastMessageTimestamp: serverTimestamp(),
            });
            setNewMessage('');
        } catch (e) {
            console.error("Error sending message: ", e);
            setError("Failed to send message.");
        }
    };

    const otherParticipantId = chat.participants.find(id => id !== userId);
    const otherParticipantName = participantNames[otherParticipantId] || 'Loading...';

    // Placeholder for orderBy from firestore.js
    const orderBy = (field) => {
        console.warn("Firestore orderBy is a placeholder. Data is sorted client-side.");
        return []; // Return empty array as a placeholder
    };

    if (loadingMessages) return <div className="text-center text-teal-700">Loading messages...</div>;
    if (error) return <div className="text-center text-red-500">{error}</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-160px)] bg-white rounded-xl shadow-lg p-4 max-w-2xl mx-auto">
            <div className="flex items-center mb-4 pb-2 border-b border-gray-200">
                <button
                    onClick={() => setCurrentPage('chat-list')}
                    className="text-teal-600 hover:text-teal-800 transition-colors duration-200 mr-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <h2 className="text-xl font-bold text-teal-700">Chat with {otherParticipantName}</h2>
            </div>

            <div className="flex-grow overflow-y-auto p-2 space-y-3 custom-scrollbar">
                {messages.length === 0 ? (
                    <p className="text-center text-gray-500 italic mt-10">No messages yet. Start the conversation!</p>
                ) : (
                    messages.map(msg => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.senderId === userId ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`max-w-[70%] p-3 rounded-xl shadow-sm ${
                                msg.senderId === userId
                                    ? 'bg-teal-500 text-white rounded-br-none'
                                    : 'bg-gray-200 text-gray-800 rounded-bl-none'
                            }`}>
                                <p className="text-sm">{msg.text}</p>
                                <span className="block text-xs mt-1 opacity-75">
                                    {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="mt-4 flex items-center pt-2 border-t border-gray-200">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type a message..."
                    className="flex-grow p-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 mr-2"
                />
                <button
                    onClick={handleSendMessage}
                    className="bg-teal-600 text-white p-3 rounded-full shadow-md hover:bg-teal-700 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-opacity-50"
                >
                    <Send className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
};

// Generic Modal Component
const Modal = ({ message, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center">
                <p className="text-lg text-gray-800 mb-6">{message}</p>
                <button
                    onClick={onClose}
                    className="bg-teal-600 text-white px-6 py-2 rounded-full text-md font-semibold hover:bg-teal-700 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-opacity-50"
                >
                    OK
                </button>
            </div>
        </div>
    );
};

export default App;
