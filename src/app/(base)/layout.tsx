import Footer from "@/components/organisms/base-footer";
import Header from "@/components/organisms/header";

export default function BaseLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className='relative z-40 flex h-full w-full min-h-screen flex-col bg-white light:bg-dark-gray-800'>
            <Header />
            <div className='flex-1'>{children}</div>
            <Footer />
        </div>
    )
}
