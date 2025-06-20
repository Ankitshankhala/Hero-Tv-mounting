
import { useState, useEffect } from 'react';

interface BlogPost {
  id: number | string;
  title: string;
  content: string;
  category: string;
  videoId?: string;
  hasVideo: boolean;
}

// Default blog posts
const defaultBlogPosts: BlogPost[] = [
  {
    id: 1,
    title: "Optimal TV Height and Viewing Angles",
    content: "Proper TV mounting height is crucial for comfortable viewing and neck health. The center of your TV screen should be at eye level when seated. For most living rooms, this means mounting the TV 42-48 inches from the floor to the center of the screen. Consider the viewing distance - your TV should be 1.5 to 2.5 times the screen size away from your seating. Tilt brackets can help achieve the perfect viewing angle, especially for TVs mounted higher than ideal. Professional TV mounting ensures optimal positioning for your specific room layout and furniture arrangement.",
    category: "Pro Tips",
    videoId: "dQw4w9WgXcQ",
    hasVideo: true
  },
  {
    id: 2,
    title: "TV Mount Types and Wall Compatibility",
    content: "Choosing the right TV mount depends on your wall type and viewing needs. Fixed mounts provide the most stability and are perfect for drywall installations. Full-motion mounts offer maximum flexibility, allowing you to tilt, swivel, and extend your TV for optimal viewing from different angles. Tilting mounts are ideal for TVs mounted above eye level. Wall compatibility is essential - drywall requires proper stud mounting, while brick, stone, and tile walls need specialized anchors and drilling techniques. Professional installers assess your wall type and recommend the best mounting solution for safety and longevity.",
    category: "Pro Tips",
    videoId: "dQw4w9WgXcQ",
    hasVideo: true
  },
  {
    id: 3,
    title: "Cable Management and Wire Concealment",
    content: "Clean cable management transforms your entertainment space from cluttered to professional. In-wall cable concealment provides the cleanest look by running cables through the wall cavity between studs. Surface-mount cable covers offer a quick solution for rentals or when in-wall isn't possible. Proper cable routing prevents signal interference and maintains optimal performance for your devices. Professional installers can relocate power outlets behind your TV for a completely wireless appearance. Fire-rated cable management ensures safety compliance while maintaining that sleek, modern aesthetic you want in your living space.",
    category: "Pro Tips",
    videoId: "dQw4w9WgXcQ",
    hasVideo: true
  }
];

// Global state for admin-created blog posts
let globalAdminBlogPosts: BlogPost[] = [];

export const useBlogData = () => {
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>(defaultBlogPosts);

  useEffect(() => {
    // Combine default posts with admin-created posts
    const allPosts = [...defaultBlogPosts, ...globalAdminBlogPosts];
    setBlogPosts(allPosts);
  }, []);

  const addAdminBlogPost = (adminPost: any) => {
    const frontendPost: BlogPost = {
      id: `admin-${Date.now()}`,
      title: adminPost.title,
      content: adminPost.content,
      category: adminPost.category,
      videoId: adminPost.hasVideo ? adminPost.videoId || "dQw4w9WgXcQ" : undefined,
      hasVideo: adminPost.hasVideo
    };
    
    globalAdminBlogPosts.unshift(frontendPost); // Add to beginning
    setBlogPosts(prev => [frontendPost, ...prev]);
  };

  return { blogPosts, addAdminBlogPost };
};
