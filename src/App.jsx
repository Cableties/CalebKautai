import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import About from './pages/About.jsx'
import FindMe from './pages/FindMe.jsx'
import Tattoo from './pages/Tattoo.jsx'
import WorkThing from './pages/WorkThing.jsx'
import GoodFriend from './pages/GoodFriend.jsx'
import LoveInterest from './pages/LoveInterest.jsx'
import Aliens from './pages/Aliens.jsx'
import CheatCodes from './pages/CheatCodes.jsx'
import DecisionWheel from './pages/DecisionWheel.jsx'
import Placeholder from './pages/Placeholder.jsx'
import NotFound from './pages/NotFound.jsx'

// Paths match the old Wix URLs so existing links (and the tattoo) keep working.
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="find-me" element={<FindMe />} />
        <Route path="tattoo" element={<Tattoo />} />
        <Route path="work" element={<WorkThing />} />
        <Route path="tattoo-work-thing" element={<WorkThing fromTattoo />} />
        <Route path="tattoo-good-friend" element={<GoodFriend />} />
        <Route path="tattoo-love-interest" element={<LoveInterest />} />
        <Route path="aliens" element={<Aliens />} />
        <Route path="cheat-codes" element={<CheatCodes />} />
        <Route path="decision-wheel" element={<DecisionWheel />} />
        <Route path="games" element={<Placeholder title="Games" blurb="The games are being rebuilt from scratch. Check back soon, or go bother an alien in the meantime." />} />
        <Route path="cotg-submission" element={<Placeholder title="CoTG" blurb="Submissions aren't open yet. When they are, this is where they'll go." />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
