import mongoose from "mongoose";
import dotenv from "dotenv";
import Codex from "../models/Codex.model.js";

dotenv.config();

const authorId = "69eca62e6cc47b43588142c5";

const article = {
  title: "Next.js Hydration Error Fix: What It Is and How to Solve It",
  subtitle: "A thorough breakdown of why Next.js throws hydration errors, what the server and client mismatch actually means, and every practical fix depending on your specific situation.",
  tags: ["nextjs", "react", "hydration", "ssr", "debugging", "frontend", "error-handling"],
  category: "development",
  readTime: "12 min read",
  content: `<div data-type="container"><div data-type="section"><h1 style="text-align: center;">Next.js Hydration Error Fix: What It Is and How to Solve It</h1><p>You open your browser. Your Next.js app loads. Then the console hits you with this:</p><pre><code>Error: Hydration failed because the initial UI does not match what was rendered on the server.
Warning: Expected server HTML to contain a matching &lt;div&gt; in &lt;div&gt;.</code></pre><p>Or sometimes the longer version:</p><pre><code>Unhandled Runtime Error
Error: There was an error while hydrating. Because the error happened outside of a Suspense boundary, the entire root will switch to client rendering.</code></pre><p>The page might still work visually. Or it might flicker. Or parts of it might disappear and reappear. Either way, something is wrong and Next.js is telling you about it.</p><p>This error confuses a lot of developers because it feels abstract. What does "hydration" even mean? Why does it matter if the server and client render something slightly different? Let me explain the whole thing from the ground up, then go through every common cause and its fix.</p><h2>What Hydration Actually Means</h2><p>When you load a Next.js page, two things happen in sequence.</p><p>First, the server renders your React components into plain HTML and sends that HTML to the browser. The browser displays it immediately. This is why Next.js pages load fast and show content even before JavaScript runs. The user sees something right away.</p><p>Second, once the JavaScript bundle downloads and executes, React takes over that existing HTML and attaches event listeners, state, and interactivity to it. This process is called hydration. React is essentially saying "I see this HTML that the server already rendered, let me connect my component tree to it."</p><p>Here is the critical part. During hydration, React does not re-render everything from scratch. It walks through the existing server HTML and matches it against what the component tree would produce on the client. If they match, great. React just attaches and moves on. If they do not match, React throws a hydration error because it does not know which version is correct.</p><p>Think of it like this. The server baked a cake and put it on the table. React comes in, looks at the cake, and tries to put candles on it based on its own recipe. If the cake the server baked looks different from what the recipe says it should look like, React panics. It does not know whether to trust the cake on the table or its own recipe.</p><h2>Why Does a Mismatch Happen?</h2><p>The server and client run your component code separately. The server runs it once during the request. The client runs it again during hydration. If anything in your component produces a different output between those two runs, you get a mismatch.</p><p>This sounds simple but it catches developers constantly because there are many subtle ways it can happen. Let me go through each one.</p><h2>Cause 1: Using Browser-Only APIs During Render</h2><p>This is the most common cause. You use something like <code>window</code>, <code>localStorage</code>, <code>navigator</code>, or <code>document</code> directly inside your component body or during the initial render. These do not exist on the server. The server renders one thing, the client renders another.</p><pre><code class="language-javascript">// This will cause a hydration error
export default function MyComponent() {
  const theme = localStorage.getItem("theme"); // localStorage does not exist on server
  return &lt;div className={theme}&gt;Hello&lt;/div&gt;;
}</code></pre><p>The server renders <code>&lt;div className={null}&gt;</code> because localStorage does not exist. The client renders <code>&lt;div className="dark"&gt;</code> because localStorage has a value. Mismatch. Hydration error.</p><p>The fix is to read browser-only values inside a <code>useEffect</code>, which only runs on the client after hydration is complete:</p><pre><code class="language-javascript">import { useState, useEffect } from "react";

export default function MyComponent() {
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    setTheme(localStorage.getItem("theme"));
  }, []);

  return &lt;div className={theme}&gt;Hello&lt;/div&gt;;
}</code></pre><p>Now the server renders <code>&lt;div className={null}&gt;</code> and the client also renders <code>&lt;div className={null}&gt;</code> during hydration. They match. After hydration, <code>useEffect</code> runs and updates the theme. No error.</p><h2>Cause 2: Dates and Times That Differ Between Server and Client</h2><p>This one is sneaky. You render something like <code>new Date().toLocaleDateString()</code> or <code>Date.now()</code> directly in your JSX. The server renders it at request time. The client renders it a few milliseconds later during hydration. The values are different. Mismatch.</p><pre><code class="language-javascript">// Hydration error waiting to happen
export default function Footer() {
  return &lt;p&gt;Current time: {new Date().toLocaleTimeString()}&lt;/p&gt;;
}</code></pre><p>Same fix as above. Move it into a <code>useEffect</code> with a state variable:</p><pre><code class="language-javascript">import { useState, useEffect } from "react";

export default function Footer() {
  const [time, setTime] = useState("");

  useEffect(() => {
    setTime(new Date().toLocaleTimeString());
  }, []);

  return &lt;p&gt;Current time: {time}&lt;/p&gt;;
}</code></pre><h2>Cause 3: Random Values or Math.random() in Render</h2><p>Same pattern. If you use <code>Math.random()</code> or any random ID generator directly in your component body, the server generates one value and the client generates a different one.</p><pre><code class="language-javascript">// Never do this
export default function Avatar() {
  const id = Math.random(); // Different on server and client
  return &lt;div id={id}&gt;User&lt;/div&gt;;
}</code></pre><p>If you need a stable unique ID, use React 18's built-in <code>useId</code> hook. It generates the same ID on both server and client:</p><pre><code class="language-javascript">import { useId } from "react";

export default function Avatar() {
  const id = useId();
  return &lt;div id={id}&gt;User&lt;/div&gt;;
}</code></pre><h2>Cause 4: Invalid HTML Nesting</h2><p>This one surprises people. The browser has strict rules about which HTML elements can be nested inside which other elements. If you write invalid HTML, the browser silently fixes it by moving elements around. But the server sends the original invalid HTML. After the browser fixes it, the DOM no longer matches what React expects. Hydration error.</p><p>Common examples of invalid nesting:</p><pre><code class="language-javascript">// Invalid: p cannot contain div
&lt;p&gt;
  &lt;div&gt;Some content&lt;/div&gt;
&lt;/p&gt;

// Invalid: a cannot contain another a
&lt;a href="/"&gt;
  &lt;a href="/about"&gt;About&lt;/a&gt;
&lt;/a&gt;

// Invalid: table without tbody
&lt;table&gt;
  &lt;tr&gt;&lt;td&gt;Cell&lt;/td&gt;&lt;/tr&gt;
&lt;/table&gt;</code></pre><p>The fix is simply to write valid HTML. Replace <code>&lt;p&gt;</code> with <code>&lt;div&gt;</code> if you need to nest block elements inside it. Make sure your table has a <code>&lt;tbody&gt;</code>. Never nest interactive elements inside each other.</p><h2>Cause 5: Browser Extensions Modifying the DOM</h2><p>This one is not your fault at all. Some browser extensions like Grammarly, password managers, or ad blockers inject elements into the DOM. React sees these injected elements during hydration and panics because they were not in the server HTML.</p><p>You will notice this error only appears in your own browser but not in production or for other users. The giveaway is error messages mentioning elements like <code>&lt;grammarly-extension&gt;</code> or extra attributes being added to your inputs.</p><p>There is nothing to fix in your code for this case. It is a known limitation. You can suppress the warning for specific elements using <code>suppressHydrationWarning</code>:</p><pre><code class="language-javascript">&lt;div suppressHydrationWarning&gt;
  {/* Content that browser extensions might modify */}
&lt;/div&gt;</code></pre><p>Use this sparingly. It tells React to ignore mismatches on that specific element and its direct children. Do not use it as a blanket solution to hide real hydration bugs in your own code.</p><h2>Cause 6: Conditional Rendering Based on Client State</h2><p>You have a component that renders differently based on whether the user is logged in, or based on a value from context or a cookie. The server does not have access to that state, so it renders the logged-out version. The client has the state and renders the logged-in version. Mismatch.</p><pre><code class="language-javascript">// This causes hydration errors if user state is not available on server
export default function Navbar() {
  const { user } = useAuth();
  return (
    &lt;nav&gt;
      {user ? &lt;span&gt;Welcome {user.name}&lt;/span&gt; : &lt;a href="/login"&gt;Login&lt;/a&gt;}
    &lt;/nav&gt;
  );
}</code></pre><p>The cleanest fix is to use a mounted state pattern. Render a neutral version on both server and client during hydration, then switch to the real version after mount:</p><pre><code class="language-javascript">import { useState, useEffect } from "react";

export default function Navbar() {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    &lt;nav&gt;
      {!mounted ? (
        &lt;a href="/login"&gt;Login&lt;/a&gt;
      ) : user ? (
        &lt;span&gt;Welcome {user.name}&lt;/span&gt;
      ) : (
        &lt;a href="/login"&gt;Login&lt;/a&gt;
      )}
    &lt;/nav&gt;
  );
}</code></pre><p>Both server and client render the login link during hydration. After hydration, <code>useEffect</code> sets mounted to true and the correct user-aware version renders. No mismatch.</p><h2>Cause 7: Third Party Libraries That Access the DOM</h2><p>Some libraries like chart libraries, rich text editors, drag and drop libraries, or map libraries try to access the DOM immediately when they load. They are not built with SSR in mind. Importing them directly causes hydration errors because they run code that only works in a browser.</p><p>Next.js has a built-in solution for this. Dynamic imports with <code>ssr: false</code> tell Next.js to skip server-side rendering for that component entirely:</p><pre><code class="language-javascript">import dynamic from "next/dynamic";

const RichTextEditor = dynamic(
  () => import("@/components/RichTextEditor"),
  { ssr: false }
);

export default function CreatePost() {
  return (
    &lt;div&gt;
      &lt;RichTextEditor /&gt;
    &lt;/div&gt;
  );
}</code></pre><p>The component will not render on the server at all. It only renders on the client after hydration. You can pass a loading fallback to show something while it loads:</p><pre><code class="language-javascript">const RichTextEditor = dynamic(
  () => import("@/components/RichTextEditor"),
  {
    ssr: false,
    loading: () => &lt;div&gt;Loading editor...&lt;/div&gt;
  }
);</code></pre><h2>How to Find Exactly Which Element Is Mismatching</h2><p>The error message in the browser console usually tells you the element type that mismatched. But sometimes it is vague. Here is how to narrow it down faster.</p><p>Open your browser DevTools and look at the full error stack. Next.js 13 and above shows a much more detailed error overlay that highlights the exact component and line. In older versions, look for the warning that says "Expected server HTML to contain a matching X in Y" and trace back which component renders that element.</p><p>You can also temporarily add <code>console.log</code> statements inside your component to log what is being rendered and compare the server output versus the client output. If you are on Next.js 13 with the App Router, check whether the component is a Server Component or Client Component. Server Components cannot use hooks or browser APIs at all.</p><h2>The Nuclear Option: Disabling SSR for a Whole Page</h2><p>If you have a page that is heavily client-side and you simply cannot make it work with SSR, you can disable server-side rendering for the entire page. This is not ideal for SEO but sometimes it is the pragmatic choice for dashboard pages or admin panels that are behind authentication anyway:</p><pre><code class="language-javascript">import dynamic from "next/dynamic";

const DashboardPage = dynamic(
  () => import("@/components/Dashboard"),
  { ssr: false }
);

export default DashboardPage;</code></pre><h2>Summary</h2><p>Hydration errors happen when the HTML the server renders does not match what React produces on the client during hydration. The most common causes are using browser-only APIs like localStorage or window during render, using dynamic values like dates or random numbers that differ between server and client, writing invalid HTML that the browser silently restructures, conditional rendering based on client-only state, and third-party libraries that are not SSR compatible. The fixes follow a consistent pattern: move browser-only code into useEffect, use the mounted state pattern for client-dependent UI, use useId for stable unique IDs, and use dynamic imports with ssr false for incompatible libraries. suppressHydrationWarning exists but should only be used for browser extension interference, not to hide real bugs in your own code.</p></div></div>`
};

async function publish() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const exists = await Codex.exists({ title: article.title });
    if (exists) {
      console.log(`⚠️  Already exists: "${article.title}"`);
      process.exit(0);
    }

    const codex = new Codex({
      ...article,
      author: authorId,
      isPublished: true,
      isDeleted: false,
    });

    await codex.save();
    console.log(`🎉 Published: "${codex.title}"`);
    console.log(`🔗 Slug: "${codex.slug}"`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

publish();
